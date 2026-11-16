# Shared by the bootstrap and the HTTPS server blocks (copied next to nginx.conf by entrypoint.sh).
gzip on;
gzip_types text/plain text/css application/json application/javascript text/xml image/svg+xml;
gzip_min_length 1024;

proxy_http_version 1.1;
proxy_set_header Host              $host;
proxy_set_header X-Real-IP         $remote_addr;
# Overwrite, never append: a client-supplied X-Forwarded-For must not reach the api's rate limiter.
proxy_set_header X-Forwarded-For   $remote_addr;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_connect_timeout 5s;
proxy_read_timeout    60s;
