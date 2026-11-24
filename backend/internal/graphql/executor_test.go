package graphql

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/juanmafx/metronome/backend/internal/session"
)

const createMutation = `mutation Create($bpm:Int!,$beatsPerBar:Int!,$subdivision:String,$sound:String!,$durationMinutes:Int,$notes:String){
  createSession(bpm:$bpm,beatsPerBar:$beatsPerBar,subdivision:$subdivision,sound:$sound,durationMinutes:$durationMinutes,notes:$notes){ id bpm notes }
}`

func newExecutor(capacity int) *Executor {
	return NewExecutor(session.NewStore(capacity, func() time.Time {
		return time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	}))
}

func validVariables() map[string]any {
	return map[string]any{"bpm": float64(120), "beatsPerBar": float64(4), "sound": "Wood", "durationMinutes": float64(5), "notes": "focus"}
}

func decode(t *testing.T, response Response) map[string]any {
	t.Helper()
	var out map[string]any
	if err := json.Unmarshal(response.Data, &out); err != nil {
		t.Fatalf("decode %q: %v (errors %v)", response.Data, err, response.Errors)
	}
	return out
}

func TestCreateThenListProjectsOnlySelectedFields(t *testing.T) {
	executor := newExecutor(10)
	created := decode(t, executor.Execute(Request{Query: createMutation, Variables: validVariables()}))
	entry := created["createSession"].(map[string]any)
	if entry["bpm"] != float64(120) || entry["notes"] != "focus" {
		t.Fatalf("unexpected session: %v", entry)
	}
	if _, leaked := entry["sound"]; leaked {
		t.Fatal("unselected field returned")
	}

	listed := decode(t, executor.Execute(Request{Query: `{ sessions { id sound } }`}))
	items := listed["sessions"].([]any)
	if len(items) != 1 || items[0].(map[string]any)["sound"] != "Wood" {
		t.Fatalf("unexpected list: %v", items)
	}
}

func TestEmptyListEncodesAsArray(t *testing.T) {
	response := newExecutor(1).Execute(Request{Query: `{ sessions { id } }`})
	if !strings.Contains(string(response.Data), `"sessions":[]`) {
		t.Fatalf("unexpected payload %s", response.Data)
	}
}

func TestSupportsLiteralsAliasesFragmentsAndDirectives(t *testing.T) {
	executor := newExecutor(10)
	literal := `mutation { saved: createSession(bpm: 100, beatsPerBar: 3, sound: "Beep") { ...Fields } }
	fragment Fields on Session { tempo: bpm ... on Session { subdivision } notes @skip(if: true) kind: __typename }`
	saved := decode(t, executor.Execute(Request{Query: literal}))["saved"].(map[string]any)
	if saved["tempo"] != float64(100) || saved["subdivision"] != "quarter" || saved["kind"] != "Session" {
		t.Fatalf("unexpected projection: %v", saved)
	}
	if _, skipped := saved["notes"]; skipped {
		t.Fatal("@skip was ignored")
	}
}

func TestMergesOverlappingSelections(t *testing.T) {
	executor := newExecutor(10)
	executor.Execute(Request{Query: createMutation, Variables: validVariables()})
	listed := decode(t, executor.Execute(Request{Query: `{ sessions { id } sessions { bpm } }`}))
	entry := listed["sessions"].([]any)[0].(map[string]any)
	if entry["id"] == nil || entry["bpm"] == nil {
		t.Fatalf("selections not merged: %v", entry)
	}
}

func TestSelectsNamedOperation(t *testing.T) {
	executor := newExecutor(10)
	query := `query A { sessions { id } } query B { __typename }`
	response := executor.Execute(Request{Query: query, OperationName: "B"})
	if decode(t, response)["__typename"] != "Query" {
		t.Fatalf("unexpected payload %s", response.Data)
	}
	if missing := executor.Execute(Request{Query: query}); !missing.IsRequestError() {
		t.Fatal("ambiguous operation must fail")
	}
}

func TestRejectsMalformedAndUnknownQueries(t *testing.T) {
	for _, query := range []string{"", "{", `{ unknownField }`, `{ sessions { password } }`, `subscription { sessions { id } }`} {
		if response := newExecutor(1).Execute(Request{Query: query}); !response.IsRequestError() {
			t.Fatalf("query %q should fail", query)
		}
	}
}

func TestSessionsSubstringNoLongerRoutesQueries(t *testing.T) {
	response := newExecutor(1).Execute(Request{Query: `{ __typename } # sessions createSession`})
	if response.IsRequestError() || strings.Contains(string(response.Data), "sessions") {
		t.Fatalf("query routed by substring: %s", response.Data)
	}
}

func TestIntrospectionIsDisabled(t *testing.T) {
	response := newExecutor(1).Execute(Request{Query: `{ __schema { types { name } } }`})
	if len(response.Errors) == 0 || strings.Contains(string(response.Data), "Session") {
		t.Fatalf("introspection exposed schema: %s", response.Data)
	}
}

func TestLimitsQueryCost(t *testing.T) {
	executor := newExecutor(100)
	var aliases strings.Builder
	for i := range 6 {
		aliases.WriteString("a" + string(rune('a'+i)) + ": sessions { id } ")
	}
	if response := executor.Execute(Request{Query: "{" + aliases.String() + "}"}); !response.IsRequestError() {
		t.Fatal("root field limit not enforced")
	}
	huge := "{ sessions { " + strings.Repeat("id ", maxQueryTokens) + "} }"
	if response := executor.Execute(Request{Query: huge}); !response.IsRequestError() {
		t.Fatal("token limit not enforced")
	}
}

func TestRepeatedFragmentSpreadsAreCollectedOnce(t *testing.T) {
	executor := newExecutor(10)
	executor.Execute(Request{Query: createMutation, Variables: validVariables()})
	const depth = 150
	var query strings.Builder
	query.WriteString("{ sessions { ...F0 } } ")
	for i := range depth {
		fmt.Fprintf(&query, "fragment F%d on Session { ...F%d ...F%d } ", i, i+1, i+1)
	}
	fmt.Fprintf(&query, "fragment F%d on Session { id }", depth)

	done := make(chan Response, 1)
	go func() { done <- executor.Execute(Request{Query: query.String()}) }()
	select {
	case response := <-done:
		entry := decode(t, response)["sessions"].([]any)[0].(map[string]any)
		if entry["id"] != float64(1) {
			t.Fatalf("unexpected projection: %v", entry)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("fragment expansion is not bounded")
	}
}

func TestRejectsAliasAmplification(t *testing.T) {
	cases := map[string]string{
		"repeated session field":  `{ sessions { first: notes second: notes } }`,
		"repeated via fragment":   `{ sessions { first: notes ...Again } } fragment Again on Session { second: notes }`,
		"repeated list field":     `{ first: sessions { id } second: sessions { id } }`,
		"repeated mutation field": `mutation { createSession(bpm: 90, beatsPerBar: 4, sound: "Click") { first: notes second: notes } }`,
	}
	for name, query := range cases {
		t.Run(name, func(t *testing.T) {
			executor := newExecutor(10)
			if response := executor.Execute(Request{Query: query}); !response.IsRequestError() {
				t.Fatalf("amplifying query accepted: %s", response.Data)
			}
			if listed := decode(t, executor.Execute(Request{Query: `{ sessions { id } }`})); len(listed["sessions"].([]any)) != 0 {
				t.Fatal("rejected mutation persisted data")
			}
		})
	}
}

func TestValidationErrorsDoNotSuggestSchemaNames(t *testing.T) {
	for _, query := range []string{
		`{ sessionz { id } }`,
		`{ sessions { bpn } }`,
		`mutation { createSession(bpn: 90, beatsPerBar: 4, sound: "Click") { id } }`,
		`query($a: Strin) { __typename }`,
	} {
		response := newExecutor(1).Execute(Request{Query: query})
		if !response.IsRequestError() {
			t.Fatalf("query %q should fail", query)
		}
		if strings.Contains(response.Errors[0].Message, "Did you mean") {
			t.Fatalf("schema suggestion leaked: %s", response.Errors[0].Message)
		}
	}
}

func TestRejectsBatchedMutationAliases(t *testing.T) {
	executor := newExecutor(100)
	query := `mutation { a: createSession(bpm: 90, beatsPerBar: 4, sound: "Click") { id } b: createSession(bpm: 90, beatsPerBar: 4, sound: "Click") { id } }`
	if response := executor.Execute(Request{Query: query}); !response.IsRequestError() {
		t.Fatal("batched mutation accepted")
	}
	if listed := decode(t, executor.Execute(Request{Query: `{ sessions { id } }`})); len(listed["sessions"].([]any)) != 0 {
		t.Fatal("rejected mutation persisted data")
	}
}

func TestDomainValidationReturnsExecutionError(t *testing.T) {
	variables := validVariables()
	variables["bpm"] = float64(500)
	response := newExecutor(1).Execute(Request{Query: createMutation, Variables: variables})
	if string(response.Data) != "null" || !strings.Contains(response.Errors[0].Message, "bpm must be between") {
		t.Fatalf("unexpected response: %s %v", response.Data, response.Errors)
	}
}

func TestRejectsNonIntegerVariables(t *testing.T) {
	for _, value := range []any{"120", 120.5, true, nil} {
		variables := validVariables()
		variables["bpm"] = value
		response := newExecutor(1).Execute(Request{Query: createMutation, Variables: variables})
		if len(response.Errors) == 0 {
			t.Fatalf("bpm %v accepted", value)
		}
	}
}

func TestIntArgumentRejectsOutOfRange(t *testing.T) {
	for _, value := range []any{int64(1 << 40), float64(1 << 40), json.Number("99999999999"), "1"} {
		if _, err := intArgument(map[string]any{"bpm": value}, "bpm"); err == nil {
			t.Fatalf("value %v accepted", value)
		}
	}
}

func TestStoreFullIsReported(t *testing.T) {
	executor := newExecutor(1)
	executor.Execute(Request{Query: createMutation, Variables: validVariables()})
	response := executor.Execute(Request{Query: createMutation, Variables: validVariables()})
	if len(response.Errors) != 1 || response.Errors[0].Message != session.ErrStoreFull.Error() {
		t.Fatalf("unexpected errors: %v", response.Errors)
	}
}

func TestInternalErrorsAreNotLeaked(t *testing.T) {
	response := executionError(errors.New("sensitive detail"))
	if response.Errors[0].Message != "internal error" {
		t.Fatalf("leaked: %v", response.Errors)
	}
}
