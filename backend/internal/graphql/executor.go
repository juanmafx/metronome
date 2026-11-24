package graphql

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"

	"github.com/juanmafx/metronome/backend/internal/session"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/gqlerror"
	"github.com/vektah/gqlparser/v2/parser"
	"github.com/vektah/gqlparser/v2/validator"
	"github.com/vektah/gqlparser/v2/validator/core"
	"github.com/vektah/gqlparser/v2/validator/rules"
)

const (
	maxQueryTokens = 2000
	maxRootFields  = 5
)

type Request struct {
	Query         string         `json:"query"`
	OperationName string         `json:"operationName"`
	Variables     map[string]any `json:"variables"`
}

type Error struct {
	Message string `json:"message"`
}

type Response struct {
	Data   json.RawMessage `json:"data,omitempty"`
	Errors []Error         `json:"errors,omitempty"`
}

func (r Response) IsRequestError() bool {
	return r.Data == nil
}

type Executor struct {
	store *session.Store
}

func NewExecutor(store *session.Store) *Executor {
	return &Executor{store: store}
}

type fieldGroups map[string][]*ast.Field

func (e *Executor) Execute(req Request) Response {
	document, parseErr := parser.ParseQueryWithTokenLimit(&ast.Source{Input: req.Query}, maxQueryTokens)
	if parseErr != nil {
		return requestError("query could not be parsed")
	}
	if errs := validator.ValidateWithRules(schema, document, newValidationRules()); len(errs) > 0 {
		return requestError(errs[0].Message)
	}

	operation := document.Operations.ForName(req.OperationName)
	if operation == nil {
		return requestError("operation could not be determined")
	}
	if operation.Operation == ast.Subscription {
		return requestError("subscriptions are not supported")
	}

	variables, varErr := validator.VariableValues(schema, operation, req.Variables)
	if varErr != nil {
		var gqlErr *gqlerror.Error
		if errors.As(varErr, &gqlErr) {
			return requestError(gqlErr.Message)
		}
		return requestError("invalid variables")
	}

	root := fieldGroups{}
	collectFields(operation.SelectionSet, variables, root, map[string]bool{})
	if len(root) > maxRootFields {
		return requestError(fmt.Sprintf("operations may select at most %d root fields", maxRootFields))
	}
	if operation.Operation == ast.Mutation && len(root) > 1 {
		return requestError("mutations may select only one root field")
	}

	selections, message := planSelections(root, variables)
	if message != "" {
		return requestError(message)
	}

	data := make(map[string]any, len(root))
	for alias, fields := range root {
		value, err := e.resolveRoot(fields, selections[alias], variables)
		if err != nil {
			return executionError(err)
		}
		data[alias] = value
	}

	encoded, err := json.Marshal(data)
	if err != nil {
		return executionError(err)
	}
	return Response{Data: encoded}
}

func newValidationRules() *rules.Rules {
	validationRules := rules.NewDefaultRules()
	for _, pair := range [][2]core.Rule{
		{rules.FieldsOnCorrectTypeRule, rules.FieldsOnCorrectTypeRuleWithoutSuggestions},
		{rules.KnownArgumentNamesRule, rules.KnownArgumentNamesRuleWithoutSuggestions},
		{rules.KnownTypeNamesRule, rules.KnownTypeNamesRuleWithoutSuggestions},
		{rules.ScalarLeafsRule, rules.ScalarLeafsRuleWithoutSuggestions},
		{rules.ValuesOfCorrectTypeRule, rules.ValuesOfCorrectTypeRuleWithoutSuggestions},
	} {
		validationRules.ReplaceRule(pair[0].Name, pair[1].RuleFunc)
	}
	return validationRules
}

func planSelections(root fieldGroups, variables map[string]any) (map[string]fieldGroups, string) {
	selections := make(map[string]fieldGroups, len(root))
	listFields := 0
	for alias, fields := range root {
		if fields[0].Name == "sessions" {
			listFields++
		}
		selection := fieldGroups{}
		visited := map[string]bool{}
		for _, field := range fields {
			collectFields(field.SelectionSet, variables, selection, visited)
		}
		if selectsFieldTwice(selection) {
			return nil, "operations may select each session field only once"
		}
		selections[alias] = selection
	}
	if listFields > 1 {
		return nil, "operations may select sessions only once"
	}
	return selections, ""
}

func selectsFieldTwice(selection fieldGroups) bool {
	seen := make(map[string]bool, len(selection))
	for _, fields := range selection {
		if seen[fields[0].Name] {
			return true
		}
		seen[fields[0].Name] = true
	}
	return false
}

func (e *Executor) resolveRoot(fields []*ast.Field, selection fieldGroups, variables map[string]any) (any, error) {
	switch fields[0].Name {
	case "__typename":
		return fields[0].ObjectDefinition.Name, nil
	case "sessions":
		listed := e.store.List()
		projected := make([]map[string]any, 0, len(listed))
		for _, item := range listed {
			projected = append(projected, projectSession(item, selection))
		}
		return projected, nil
	case "createSession":
		draft, err := draftFromArguments(fields[0].ArgumentMap(variables))
		if err != nil {
			return nil, err
		}
		created, err := e.store.Create(draft)
		if err != nil {
			return nil, err
		}
		return projectSession(created, selection), nil
	default:
		return nil, &session.ValidationError{Field: fields[0].Name, Message: "introspection is disabled"}
	}
}

func collectFields(selections ast.SelectionSet, variables map[string]any, out fieldGroups, visited map[string]bool) {
	for _, selection := range selections {
		switch node := selection.(type) {
		case *ast.Field:
			if isIncluded(node.Directives, variables) {
				out[node.Alias] = append(out[node.Alias], node)
			}
		case *ast.InlineFragment:
			if isIncluded(node.Directives, variables) {
				collectFields(node.SelectionSet, variables, out, visited)
			}
		case *ast.FragmentSpread:
			if isIncluded(node.Directives, variables) && !visited[node.Name] {
				visited[node.Name] = true
				collectFields(node.Definition.SelectionSet, variables, out, visited)
			}
		}
	}
}

func isIncluded(directives ast.DirectiveList, variables map[string]any) bool {
	if skip := directives.ForName("skip"); skip != nil && skip.ArgumentMap(variables)["if"] == true {
		return false
	}
	if include := directives.ForName("include"); include != nil && include.ArgumentMap(variables)["if"] == false {
		return false
	}
	return true
}

func projectSession(item session.Session, selection fieldGroups) map[string]any {
	projected := make(map[string]any, len(selection))
	for alias, fields := range selection {
		switch fields[0].Name {
		case "__typename":
			projected[alias] = "Session"
		case "id":
			projected[alias] = item.ID
		case "bpm":
			projected[alias] = item.BPM
		case "beatsPerBar":
			projected[alias] = item.BeatsPerBar
		case "subdivision":
			projected[alias] = item.Subdivision
		case "sound":
			projected[alias] = item.Sound
		case "durationMinutes":
			projected[alias] = item.DurationMinutes
		case "notes":
			projected[alias] = item.Notes
		case "createdAt":
			projected[alias] = item.CreatedAt
		}
	}
	return projected
}

func draftFromArguments(arguments map[string]any) (session.Draft, error) {
	bpm, err := intArgument(arguments, "bpm")
	if err != nil {
		return session.Draft{}, err
	}
	beatsPerBar, err := intArgument(arguments, "beatsPerBar")
	if err != nil {
		return session.Draft{}, err
	}
	durationMinutes, err := intArgument(arguments, "durationMinutes")
	if err != nil {
		return session.Draft{}, err
	}
	subdivision, _ := arguments["subdivision"].(string)
	sound, _ := arguments["sound"].(string)
	notes, _ := arguments["notes"].(string)
	return session.Draft{
		BPM:             bpm,
		BeatsPerBar:     beatsPerBar,
		Subdivision:     subdivision,
		Sound:           sound,
		DurationMinutes: durationMinutes,
		Notes:           notes,
	}, nil
}

func intArgument(arguments map[string]any, name string) (int, error) {
	switch value := arguments[name].(type) {
	case nil:
		return 0, nil
	case int:
		return value, nil
	case int32:
		return int(value), nil
	case int64:
		if value >= math.MinInt32 && value <= math.MaxInt32 {
			return int(value), nil
		}
	case float64:
		if value == math.Trunc(value) && value >= math.MinInt32 && value <= math.MaxInt32 {
			return int(value), nil
		}
	case json.Number:
		parsed, err := value.Int64()
		if err == nil && parsed >= math.MinInt32 && parsed <= math.MaxInt32 {
			return int(parsed), nil
		}
	}
	return 0, &session.ValidationError{Field: name, Message: name + " must be a 32-bit integer"}
}

func requestError(message string) Response {
	return Response{Errors: []Error{{Message: message}}}
}

func executionError(err error) Response {
	message := "internal error"
	var validationErr *session.ValidationError
	switch {
	case errors.As(err, &validationErr):
		message = validationErr.Message
	case errors.Is(err, session.ErrStoreFull):
		message = session.ErrStoreFull.Error()
	}
	return Response{Data: json.RawMessage("null"), Errors: []Error{{Message: message}}}
}
