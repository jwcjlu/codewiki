package data

import (
	"codewiki/internal/biz"
	"context"
	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
	"testing"
)

func TestNeo4j(t *testing.T) {
	driver, err := createDriver()
	if err != nil {
		t.Fatal(err)
	}
	err = createPerson(driver, "hex", 18)
	if err != nil {
		t.Fatal(err)
	}

}

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
func createPerson(driver neo4j.DriverWithContext, name string, age int) error {
	ctx := context.Background()
	session := driver.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)

	_, err := session.ExecuteWrite(ctx, savePackage(ctx, &biz.Package{
		ID:       "dragonfly",
		Name:     "dragonfly",
		ParentID: "dragonfly",
		Path:     "dragonfly",
	}))

	return err
}

func savePackage(ctx context.Context, pkg *biz.Package) func(tx neo4j.ManagedTransaction) (any, error) {
	return func(tx neo4j.ManagedTransaction) (any, error) {
		query := `
       CREATE (p:Package {
           id: $id,
           name: $name,
           parent_id: $parent_id,
           path: $path
        })`

		params := map[string]any{
			"id":        pkg.ID,
			"name":      pkg.Name,
			"path":      pkg.Path,
			"parent_id": pkg.ParentID,
		}

		_, err := tx.Run(ctx, query, params)
		if err != nil {
			return nil, err
		}
		return nil, nil
	}

}
