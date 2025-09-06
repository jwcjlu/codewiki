package localcache_test

import (
	"codewiki/internal/pkg/localcache"
	"fmt"
	"testing"
	"time"
)

type simpleKey struct {
	key string
}

func (key *simpleKey) KeyString() string {
	return key.key
}

func TestLocalCache_Get(t *testing.T) {
	cache := localcache.NewLocalCache(func(key *simpleKey) (*simpleKey, error) {
		return key, nil
	}, 15*time.Second, 3)
	v1, _ := cache.Get(&simpleKey{key: "111"})
	fmt.Println(v1)
	v2, _ := cache.Get(&simpleKey{key: "222"})
	fmt.Println(v2)
	v3, _ := cache.Get(&simpleKey{key: "333"})
	fmt.Println(v3)
	v4, _ := cache.Get(&simpleKey{key: "444"})
	fmt.Println(v4)
	time.Sleep(15 * time.Second)
	v1, _ = cache.Get(&simpleKey{key: "222"})
	fmt.Println(v1)
	time.Sleep(1 * time.Second)

}
