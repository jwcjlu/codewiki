package data

import (
	"codewiki/internal/conf"
	"codewiki/internal/data/repo"
	"context"
	"github.com/go-kratos/kratos/v2/log"
	"github.com/google/wire"
	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
	"time"
)

// ProviderSet is data providers.
var ProviderSet = wire.NewSet(NewData, repo.NewProjectRepo, NewDriverWithContext)

// Data .
type Data struct {
	neo4jDriver neo4j.DriverWithContext
}

// NewData .
func NewData(c *conf.Data, logger log.Logger) (*Data, func(), error) {

	neo4jDriver, err := neo4j.NewDriverWithContext(c.Neo4J.Target,
		neo4j.BasicAuth(c.Neo4J.Username, c.Neo4J.Password, ""),
		func(c *neo4j.Config) {
			c.MaxConnectionPoolSize = 100
			c.ConnectionAcquisitionTimeout = 10 * time.Minute
			c.MaxTransactionRetryTime = 10 * time.Minute
		},
	)
	if err != nil {
		return nil, nil, err
	}
	if err = neo4jDriver.VerifyConnectivity(context.Background()); err != nil {
		return nil, nil, err
	}
	cleanup := func() {
		neo4jDriver.Close(context.Background())
		log.NewHelper(logger).Info("closing the data resources")
	}
	return &Data{neo4jDriver: neo4jDriver}, cleanup, nil
}

func NewDriverWithContext(data *Data) neo4j.DriverWithContext {
	return data.neo4jDriver
}
