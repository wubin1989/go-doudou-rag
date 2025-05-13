package contextutil

import (
	"context"
	"net/http"
)

const (
	responseWriterKey = "responseWriterKey"
)

func NewResponseWriterContext(ctx context.Context, w http.ResponseWriter) context.Context {
	return context.WithValue(ctx, responseWriterKey, w)
}

func ResponseWriterFromContext(ctx context.Context) (http.ResponseWriter, bool) {
	w, ok := ctx.Value(responseWriterKey).(http.ResponseWriter)
	return w, ok
}
