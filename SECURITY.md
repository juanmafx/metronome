# Security Policy

## Supported versions

| Version | Supported |
| --- | --- |
| 1.x | Yes |
| Below 1.0 | No |

## Reporting a vulnerability

Please report vulnerabilities privately through the repository's **Security** tab using **Report a vulnerability**. If that option is unavailable, open an issue asking for a private contact channel and do not include technical details.

Include the affected version, the impact and the steps to reproduce.

## Deployment guidance

The API has **no authentication** and is designed for local use. It binds to `127.0.0.1` by default. Before exposing it to a network:

- Put it behind an authenticating reverse proxy with TLS.
- Set `METRONOME_ALLOWED_ORIGINS` to the exact production origins.
- Serve the frontend with a `Content-Security-Policy: frame-ancestors 'none'` response header, because a `<meta>` CSP cannot set that directive.
- Note that rate limiting keys on the connecting IP and ignores forwarded headers, so all traffic through a proxy shares one limit.
