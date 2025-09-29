package main

import (
	"fmt"
	"reflect"

	"github.com/ovechkin-dm/go-dyno/pkg/dyno"
	"github.com/samber/do"
	"github.com/samber/lo"
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
	var g Greeter
	g = &SimpleGreeter{}
	do.ProvideNamedValue[Greeter](nil, "greeterBean", g)

	lo.ForEach(do.DefaultInjector.ListProvidedServices(), func(item string, index int) {
		fmt.Printf("item: %s\n", item)
		greeter := do.MustInvokeNamed[Greeter](nil, item)
		proxyHandler := &ProxyHandler[any]{Impl: greeter}
		dynamicGreeter, err := dyno.DynamicByType(proxyHandler.Handle, reflect.TypeOf(greeter))
		if err != nil {
			panic(err)
		}
		do.OverrideNamedValue(nil, item, dynamicGreeter)
	})

	greeter := do.MustInvokeNamed[any](nil, "greeterBean")
	dynaGreeter := greeter.(Greeter)
	fmt.Println(dynaGreeter.Greet())
	fmt.Println(dynaGreeter.SayHello("World"))
}
