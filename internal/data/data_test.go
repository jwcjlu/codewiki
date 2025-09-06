package data

import (
	"context"
	"fmt"
	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
	"testing"
)

func createDriver() (neo4j.DriverWithContext, error) {
	driver, err := neo4j.NewDriverWithContext(
		"bolt://localhost:7687", // 或 "neo4j://localhost:7687"
		neo4j.BasicAuth("neo4j", "jw123456", ""),
	)
	if err != nil {
		return nil, err
	}

	// 验证连接
	ctx := context.Background()
	if err = driver.VerifyConnectivity(ctx); err != nil {
		return nil, err
	}

	return driver, nil
}

func TestQueryFunctionCallChains(t *testing.T) {

	driver, err := createDriver()
	if err != nil {
		t.Fatal(err)
	}
	session := driver.NewSession(context.Background(), neo4j.SessionConfig{})
	defer session.Close(context.Background())
	query := `MATCH path = (start:Function {id: $startFunctionName})-[:Call*]->(end:Function)
        UNWIND relationships(path) AS rel
        WITH startNode(rel) AS caller, endNode(rel) AS callee
        RETURN caller.id AS callerID, caller.name AS callerName,
               callee.id AS calleeID, callee.name AS calleeName`

	result, err := session.Run(context.Background(), query, map[string]interface{}{"startFunctionName": ""},
		func(config *neo4j.TransactionConfig) {

		})
	if err != nil {
		t.Fatal(err)
	}
	rs, err := result.Collect(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	for _, v := range rs {
		fmt.Println(v)
	}

}
