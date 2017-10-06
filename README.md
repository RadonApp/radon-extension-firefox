# Neon Extension for Firefox
[![](https://img.shields.io/travis/NeApp/neon-extension-firefox.svg)](https://travis-ci.org/NeApp/neon-extension-firefox)

> *Google Music Scrobbler* is now part of the [*Neon*](https://github.com/NeApp) project.
> 
> [*Neon*](https://github.com/NeApp) is a complete rewrite of *Google Music Scrobbler* with support for Firefox 57+, and has been designed to support many more sources and destinations in the future.

> **Note:** The extension is currently still listed on [addons.mozilla.org](https://addons.mozilla.org) as [*Google Music Scrobbler*](https://addons.mozilla.org/en-US/firefox/addon/google-music-scrobbler/), this will be updated once a stable release is ready.

## Issues

Issues can be reported in the [neon-extension](https://github.com/NeApp/neon-extension) repository.

**Please include the following details:**

 - Browser Version
 - Extension Version
 - Operating System

## Releases

Releases are currently available on the *Development Channel* at [addons.mozilla.org](https://addons.mozilla.org/en-US/firefox/addon/google-music-scrobbler/), or the GitHub [Releases](https://github.com/NeApp/neon-extension-firefox/releases) page.

Currently working on a stable release for review and release in October 2017.

## Build

### Production

**Requirements**

 - node
 - npm
 - *git (optional)*

**Steps**

1. **Download build files**

    Clone the repository, and checkout the desired version:

    ```
    git clone git@github.com:NeApp/neon-extension-firefox.git
    git checkout (version)
    ```

    or download the release archive:

    ```
    wget https://github.com/NeApp/neon-extension-firefox/archive/(version).zip
    ```

2. **Install dependencies**

    ```
    npm install
    ```

3. **Run build**

    ```
    npm run build
    ```

    Build artifacts will be available at `build/production/`
