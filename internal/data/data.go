package data

import (
	"codewiki/internal/conf"
	"codewiki/internal/data/repo"
	"context"
	"fmt"
	"github.com/go-kratos/kratos/v2/log"
	"github.com/google/wire"
	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
	"github.com/qdrant/go-client/qdrant"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"time"
)

// ProviderSet is data providers.
var ProviderSet = wire.NewSet(NewData, NewDriverWithContext, NewGormDB, repo.NewCompositeRepo, repo.NewMilvus)

// Data .
type Data struct {
	neo4jDriver  neo4j.DriverWithContext
	gormDB       *gorm.DB
	pointsClient *qdrant.PointsClient
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

// NewGormDB initializes MySQL GORM connection if configured
func NewGormDB(c *conf.Data, logger log.Logger) (*gorm.DB, error) {
	if c.Database == nil {
		return nil, fmt.Errorf("database config is nil")
	}
	db, err := gorm.Open(mysql.Open(c.Database.Source), &gorm.Config{})
	if err != nil {
		return nil, err
	}
	return db, nil
}

func getenv(key, def string) string {
	if v := getenv0(key); v != "" {
		return v
	}
	return def
}

// small indirection for testability
var getenv0 = func(k string) string { return "" }
