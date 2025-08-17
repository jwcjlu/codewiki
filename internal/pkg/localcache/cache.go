package localcache

import (
	"github.com/go-kratos/kratos/v2/log"

	"sort"
	"sync"
	"time"
)

type Cache[K Key, V any] interface {
	Get(key K) (V, error)
	Put(key K, val V) error
}
type localCache[K Key, V any] struct {
	warpFun    func(key K) (V, error)
	values     map[string]warpVal[V]
	expire     time.Duration
	capacity   int
	lock       sync.RWMutex
	ignoredErr func(error) bool
}

type warpVal[T any] struct {
	createTime time.Time
	realVal    T
	err        error
}

func newWarpVal[T any](val T, err error) warpVal[T] {
	return warpVal[T]{
		createTime: time.Now(),
		realVal:    val,
		err:        err,
	}
}

func (val *warpVal[T]) isExpire(expire time.Duration) bool {
	flag := time.Now().Unix()-val.createTime.Unix() > int64(expire.Seconds())
	if flag {
		log.Debugf("key is expire %#v", val)
	}
	return flag
}

type Key interface {
	KeyString() string
}

func NewLocalCache[K Key, V any](warpFun func(key K) (V, error), expire time.Duration, capacity int, os ...CacheOption) Cache[K, V] {
	if expire <= 0 {
		expire = time.Hour
	}
	if capacity <= 0 {
		capacity = 100
	}
	ops := newCacheOptions()
	for _, o := range os {
		o(ops)
	}
	return &localCache[K, V]{
		warpFun:    warpFun,
		values:     make(map[string]warpVal[V]),
		expire:     expire,
		lock:       sync.RWMutex{},
		capacity:   capacity,
		ignoredErr: ops.ignoredErr,
	}
}

func (cache *localCache[K, V]) disuseIfNeeded() {
	if len(cache.values) < cache.capacity {
		return
	}
	cache.lock.Lock()
	defer cache.lock.Unlock()
	reduce := len(cache.values) - cache.capacity/2
	type key struct {
		createTime time.Time
		key        string
	}
	var keys []key
	for k, v := range cache.values {
		if v.isExpire(cache.expire) {
			delete(cache.values, k)
			reduce--
		}
		if reduce == 0 {
			return
		}
		keys = append(keys, key{createTime: v.createTime, key: k})
	}
	//对时间进行排序，先删除缓存时间长的数据
	sort.Slice(keys, func(i, j int) bool {
		if keys[i].createTime.Before(keys[j].createTime) {
			return true
		}
		return false
	})
	for _, k := range keys {
		log.Debugf("delete val for capacity val[%#v]", cache.values[k.key])
		delete(cache.values, k.key)
		reduce--
		if reduce <= 0 {
			return
		}
	}

}
func (cache *localCache[K, V]) Put(key K, val V) error {
	cache.lock.Lock()
	cache.values[key.KeyString()] = newWarpVal(val, nil)
	cache.lock.Unlock()
	cache.disuseIfNeeded()
	return nil
}
func (cache *localCache[K, V]) Get(key K) (V, error) {
	cache.lock.RLock()
	value, ok := cache.values[key.KeyString()]

	if !ok || value.isExpire(cache.expire) {
		cache.lock.RUnlock()
		val, err := cache.warpFun(key)
		if err != nil && !cache.ignoredErr(err) {
			log.Warnf("warpFun failure %v,error[%v]", key, err)
			return val, err
		}
		cache.lock.Lock()
		cache.values[key.KeyString()] = newWarpVal(val, err)
		value = cache.values[key.KeyString()]
		cache.lock.Unlock()
	} else {
		cache.lock.RUnlock()
	}
	cache.disuseIfNeeded()
	return value.realVal, value.err
}

type CacheOptions struct {
	ignoredErr func(error) bool
}

func newCacheOptions() *CacheOptions {
	return &CacheOptions{
		ignoredErr: func(err error) bool {
			return false
		},
	}
}

type CacheOption func(o *CacheOptions)

func WithIgnoredErr(ignoredErr func(error) bool) CacheOption {
	return func(o *CacheOptions) {
		o.ignoredErr = ignoredErr
	}
}
