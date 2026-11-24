package graphql

import (
	"github.com/vektah/gqlparser/v2"
	"github.com/vektah/gqlparser/v2/ast"
)

const schemaSource = `
type Session {
  id: Int!
  bpm: Int!
  beatsPerBar: Int!
  subdivision: String!
  sound: String!
  durationMinutes: Int!
  notes: String!
  createdAt: String!
}

type Query {
  sessions: [Session!]!
}

type Mutation {
  createSession(
    bpm: Int!
    beatsPerBar: Int!
    subdivision: String
    sound: String!
    durationMinutes: Int
    notes: String
  ): Session!
}
`

var schema = gqlparser.MustLoadSchema(&ast.Source{Name: "schema.graphql", Input: schemaSource})
