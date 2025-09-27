package aop

import (
	"fmt"
	"reflect"
)

type ProxyHandler[T any] struct {
	Impl T
}

func (p *ProxyHandler[T]) Handle(m reflect.Method, values []reflect.Value) []reflect.Value {
	fmt.Println("Method called:", m.Name)
	return reflect.ValueOf(p.Impl).MethodByName(m.Name).Call(values)
}
