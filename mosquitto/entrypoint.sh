#!/bin/sh
set -eu

: "${MQTT_BACKEND_USER:?MQTT_BACKEND_USER is required}"
: "${MQTT_BACKEND_PASSWORD:?MQTT_BACKEND_PASSWORD is required}"
: "${MQTT_DEVICE_USER:?MQTT_DEVICE_USER is required}"
: "${MQTT_DEVICE_PASSWORD:?MQTT_DEVICE_PASSWORD is required}"

PASSWD_FILE=/mosquitto/data/passwd
rm -f "$PASSWD_FILE"
mosquitto_passwd -b -c "$PASSWD_FILE" "$MQTT_BACKEND_USER" "$MQTT_BACKEND_PASSWORD"
mosquitto_passwd -b "$PASSWD_FILE" "$MQTT_DEVICE_USER" "$MQTT_DEVICE_PASSWORD"
chown mosquitto:mosquitto "$PASSWD_FILE" 2>/dev/null || true
chmod 640 "$PASSWD_FILE"

cp /mosquitto/config/acl /mosquitto/data/acl
chown mosquitto:mosquitto /mosquitto/data/acl 2>/dev/null || true
chmod 0700 /mosquitto/data/acl

exec /usr/sbin/mosquitto -c /mosquitto/config/mosquitto.conf
