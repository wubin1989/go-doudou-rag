package main

import (
	"fmt"
	"reflect"

	"github.com/ovechkin-dm/go-dyno/pkg/dyno"
)

type Greeter interface {
	Greet() string
	SayHello(name string) string
}

type SimpleGreeter struct {
}

func (g *SimpleGreeter) Greet() string {
	return "Hello!"
}

func (g *SimpleGreeter) SayHello(name string) string {
	return fmt.Sprintf("Hello, %s!", name)
}

type ProxyHandler[T any] struct {
	Impl T
}

func (p *ProxyHandler[T]) Handle(m reflect.Method, values []reflect.Value) []reflect.Value {
	fmt.Println("Method called:", m.Name)
	return reflect.ValueOf(p.Impl).MethodByName(m.Name).Call(values)
}

func main() {
	greeter := &SimpleGreeter{}
	proxyHandler := &ProxyHandler[Greeter]{Impl: greeter}
	dynamicGreeter, err := dyno.Dynamic[Greeter](proxyHandler.Handle)
	if err != nil {
		fmt.Println("Error creating dynamic greeter:", err)
		return
	}

	fmt.Println(dynamicGreeter.Greet())
	fmt.Println(dynamicGreeter.SayHello("World"))
}
