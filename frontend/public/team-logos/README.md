# Team logos

The 30 SVG files in this directory are the official primary marks of the NBA
teams, downloaded from the NBA's public logo CDN:

```
https://cdn.nba.com/logos/nba/<nba_id>/global/L/logo.svg
```

They are bundled locally so the dashboard does not depend on a third-party CDN
at runtime. `TeamBadge` falls back to a team-color abbreviation tile if a file
is missing.

These logos are trademarks of their respective teams and the NBA. They are
included for team identification only and are **not** covered by PaLaro's MIT
license, which applies to the source code.
