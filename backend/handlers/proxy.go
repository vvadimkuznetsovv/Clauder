package handlers

import (
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"

	"github.com/gin-gonic/gin"
)

// CodeServerProxy returns a Gin handler that reverse-proxies to code-server.
// Auth is handled by middleware.AuthRequired on the route group.
func CodeServerProxy() gin.HandlerFunc {
	target, _ := url.Parse("http://code-server:8443")

	proxy := &httputil.ReverseProxy{
		Director: func(req *http.Request) {
			req.URL.Scheme = target.Scheme
			req.URL.Host = target.Host
			req.Host = target.Host

			// Strip /code prefix — code-server expects root paths
			req.URL.Path = strings.TrimPrefix(req.URL.Path, "/code")
			if req.URL.Path == "" {
				req.URL.Path = "/"
			}

			// Remove the token query param so it doesn't leak to code-server
			q := req.URL.Query()
			q.Del("token")
			req.URL.RawQuery = q.Encode()
		},
	}

	return func(c *gin.Context) {
		proxy.ServeHTTP(c.Writer, c.Request)
	}
}
