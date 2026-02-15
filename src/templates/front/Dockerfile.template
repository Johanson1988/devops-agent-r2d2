FROM nginx:1.25-alpine

# Copy custom nginx config
COPY src/nginx.conf /etc/nginx/conf.d/default.conf

# Copy application files
COPY src/index.html /usr/share/nginx/html/

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# Run nginx
CMD ["nginx", "-g", "daemon off;"]
