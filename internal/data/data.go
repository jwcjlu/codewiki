package data

import (
	"codewiki/internal/conf"
	"codewiki/internal/data/repo"
	"github.com/go-kratos/kratos/v2/log"
	"github.com/google/wire"
	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
)

// ProviderSet is data providers.
var ProviderSet = wire.NewSet(NewData, repo.NewEntityRepo, NewDriverWithContext)

// Data .
type Data struct {
	neo4jDriver neo4j.DriverWithContext
}

// NewData .
func NewData(c *conf.Data, logger log.Logger) (*Data, func(), error) {
	neo4jDriver, err := neo4j.NewDriverWithContext(c.Neo4J.Target,
		neo4j.BasicAuth(c.Neo4J.Username, c.Neo4J.Password, ""),
	)
	if err != nil {
		return nil, nil, err
	}
	cleanup := func() {
		log.NewHelper(logger).Info("closing the data resources")
	}
	return &Data{neo4jDriver: neo4jDriver}, cleanup, nil
}

func NewDriverWithContext(data *Data) neo4j.DriverWithContext {
	return data.neo4jDriver
}
