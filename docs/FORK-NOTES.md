# Fork-Notizen: Branch-/Tag-Workflow

> Internes Betriebshandbuch für den Fork
> [chrisschm/grav-plugin-page-stats](https://github.com/chrisschm/grav-plugin-page-stats),
> solange offen ist, ob [PR #54](https://github.com/francodacosta/grav-plugin-page-stats/pull/54)
> beim Original-Repo (`francodacosta/grav-plugin-page-stats`) gemerged wird.
> Keine Beitrags-Richtlinie für Dritte (dafür ggf. später eine echte
> `CONTRIBUTING.md`) – nur Gedächtnisstütze für uns selbst.

## Warum dieses Dokument existiert

`francodacosta`s eigene Grav-Website befand sich zum Zeitpunkt dieser
Notiz im Installationsmodus – ein Hinweis darauf, dass eine Reaktion auf
PR #54 ungewiss ist, zeitlich wie inhaltlich. Bis sich das klärt, arbeiten
wir trotzdem weiter am Plugin (Admin2-Dashboard-Verbesserungen,
Bugfixes) und brauchen dafür eine Struktur, die **beide** möglichen
Ausgänge offenhält, ohne dass wir uns vorher festlegen müssen.

## Branch-Bedeutung

| Branch    | Zweck                                                                    | Synchron mit Original? |
|-----------|---------------------------------------------------------------------------|-------------------------|
| `master`  | Stabil: nur Commits, die auch im Original-Repo akzeptiert wurden (Original + akzeptierte PRs). | Ja |
| `develop` | Alle lokalen Änderungen, die noch nicht im Original sind.                | Nein |

Auf dem Server per `git switch master` / `git switch develop` schnell
umschaltbar.

## Tag-Schema

Tags markieren einen **verifizierten, stabilen Stand** auf `develop` –
nicht jeden einzelnen Commit. Namensschema (passend zum bereits
etablierten Datums-Schema der Chat-Zusammenfassungen):

```
develop-JJJJ-MM-TT
```

Setzen, nachdem ein Stand auf dem Server geprüft wurde:

```bash
git switch develop
git status                     # muss "clean" sein
git tag -a develop-2026-07-25 -m "Kurzbeschreibung des Stands"
git push origin develop-2026-07-25   # Tags werden NICHT automatisch mit "git push" mitgeschickt
```

Kontrolle:

```bash
git tag -l
git ls-remote --tags origin
```

**Wichtige Regel:** Sobald ein Commit getaggt ist, nicht mehr per
`reset --hard` oder Rebase über ihn hinweg zurückgehen – sonst zeigt der
Tag ins Leere. Das schon einmal bewusst durchgeführte `reset --hard
HEAD~2` auf `master` (Abspaltung von `develop`, siehe Commit-Historie)
war unkritisch, weil zu dem Zeitpunkt noch kein Tag auf den entfernten
Commits saß.

## Commit-Message-Konvention

An der bisherigen Historie orientiert: `feat:`, `fix:`, `docs:`,
`sync:`-Präfixe, ein Anliegen pro Commit, wo sinnvoll trennbar.

## Eigenständige Fixes / möglicher separater PR

Manche Änderungen sind inhaltlich unabhängig vom Admin2-Dashboard aus
PR #54 (z. B. reine Datenschicht-Bugfixes in `classes/Stats.php`, die
auch unter klassischem Admin1 relevant wären). Solche Fixes müssen
**nicht** vorab in einen eigenen Branch ausgelagert werden – dafür reicht
es, sie als eigenen, in sich geschlossenen Commit auf `develop` zu
machen. Falls sich später zeigt, dass ein eigenständiger PR dafür Sinn
ergibt, lässt sich der Commit per `git cherry-pick` nachträglich
herausziehen:

```bash
git switch master
git switch -c fix/<kurzbeschreibung>
git cherry-pick <commit-hash>
git push origin fix/<kurzbeschreibung>
# → PR gegen francodacosta/grav-plugin-page-stats öffnen
```

**Aktuelle Einschätzung (Stand dieser Notiz):** Angesichts der
ungewissen Maintainer-Aktivität wird das vorerst nicht aktiv verfolgt –
weitere PRs gegen das Original-Repo ergeben erst wieder Sinn, wenn sich
zeigt, dass dort überhaupt reagiert wird.

## Zwei offene Zukunftspfade

- **PR #54 wird gemerged:** `upstream/master` in eigenen `master`
  mergen, danach `develop` per `git rebase master` (oder bei
  Konflikten einfacher: `git merge master`) nachziehen.
- **Keine Reaktion vom Maintainer:** `develop` wird zum neuen `master`
  eines eigenständigen Forks/Plugins. Erst dann wird ein "echter"
  Versions-Tag (z. B. `v2.9.0` oder klar unterscheidbar wie
  `v3.0.0-jcs`) und ein GitHub-Release mit ZIP-Asset sinnvoll – falls
  eine eigenständige GPM-Veröffentlichung angestrebt wird. Achtung:
  das automatische GitHub-Source-ZIP hat als Top-Level-Ordner
  `grav-plugin-page-stats-<version>/`, nicht `page-stats/` – für
  Fremdnutzer ggf. ein eigenes, korrekt benanntes ZIP als Release-Asset
  ergänzen.

Beide Pfade bleiben mit der aktuellen `master`/`develop`-Struktur offen;
es ist keine Vorab-Entscheidung nötig.
