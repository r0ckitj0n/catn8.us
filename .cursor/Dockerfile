# Base image for the catn8.us Cloud Agent environment.
#
# Node 22 comes from the base image (Vite 7 requires Node >= 20.19 / 22.12).
# The backend is PHP + MySQL, so PHP 8.2 (with the extensions the app uses),
# Composer, and MariaDB are layered on top. Only stable system-level toolchains
# live here; project dependencies are installed from lockfiles in .cursor/install.sh.
FROM node:22-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        git \
        unzip \
        php-cli \
        php-mysql \
        php-mbstring \
        php-curl \
        php-xml \
        php-zip \
        php-gd \
        php-bcmath \
        php-intl \
        mariadb-server \
        mariadb-client \
    && curl -fsSL https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer \
    && composer --version \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

USER node
