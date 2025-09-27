package auth

import (
	"context"
	"fmt"
	"go-doudou-rag/toolkit/config"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/unionj-cloud/go-doudou/v2/framework"
	"github.com/unionj-cloud/go-doudou/v2/framework/rest/httprouter"
	"github.com/unionj-cloud/toolkit/copier"
)

var authMiddleware *AuthMiddleware

func init() {
	conf := config.LoadFromEnv()
	authMiddleware = &AuthMiddleware{
		JwtSecret:    conf.Auth.JwtSecret,
		JwtExpiresIn: conf.Auth.JwtExpiresIn,
	}
}

func JwtToken(userInfo UserInfo) (token string, expire time.Time) {
	return authMiddleware.JwtToken(userInfo)
}

func Jwt(inner http.Handler) http.Handler {
	return authMiddleware.Jwt(inner)
}

type AuthMiddleware struct {
	JwtSecret    string
	JwtExpiresIn time.Duration
}

type UserInfo struct {
	Username string `json:"username"`
}

type ctxKey int

const userInfoKey ctxKey = ctxKey(0)

func NewUserInfoContext(ctx context.Context, userInfo UserInfo) context.Context {
	return context.WithValue(ctx, userInfoKey, userInfo)
}

func UserInfoFromContext(ctx context.Context) (UserInfo, bool) {
	userInfo, ok := ctx.Value(userInfoKey).(UserInfo)
	return userInfo, ok
}

func (auth *AuthMiddleware) JwtToken(userInfo UserInfo) (token string, expire time.Time) {
	var claims jwt.MapClaims
	err := copier.DeepCopy(userInfo, &claims)
	if err != nil {
		panic(err)
	}

	expire = time.Now().Add(auth.JwtExpiresIn)
	claims["exp"] = expire.Unix()

	token, err = jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(auth.JwtSecret))
	if err != nil {
		panic(err)
	}
	return token, expire
}

func (auth *AuthMiddleware) Jwt(inner http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "/go-doudou/") || !strings.HasPrefix(r.URL.Path, "/module") {
			inner.ServeHTTP(w, r)
			return
		}

		paramsFromCtx := httprouter.ParamsFromContext(r.Context())
		routeName := paramsFromCtx.MatchedRouteName()

		annotation, ok := framework.GetAnnotation(routeName, "@role")
		if ok && slices.Contains(annotation.Params, "guest") {
			inner.ServeHTTP(w, r)
			return
		}

		authHeader := r.Header.Get("Authorization")
		tokenString := strings.TrimSpace(strings.TrimPrefix(authHeader, "Bearer "))

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return []byte(auth.JwtSecret), nil
		})
		if err != nil || !token.Valid {
			w.WriteHeader(401)
			w.Write([]byte("Unauthorised.\n"))
			return
		}

		claims := token.Claims.(jwt.MapClaims)

		var userInfo UserInfo
		err = copier.DeepCopy(claims, &userInfo)
		if err != nil {
			panic(err)
		}

		r = r.WithContext(NewUserInfoContext(r.Context(), userInfo))
		inner.ServeHTTP(w, r)
	})
}
