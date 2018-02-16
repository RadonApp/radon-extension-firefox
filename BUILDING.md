# Building

### Requirements

**Software**

 - Node.js (7+)
 - npm (5.5.1+)

### Build

1. Download the source archive from [GitHub](https://github.com/NeApp/neon-extension-firefox/releases) with the name `Neon-Firefox-<version>-sources.zip` and extract the contents of the archive to a temporary directory.

2. Open a command prompt or shell, and CD to the source directory.

    ```
    cd Neon-Firefox-<version>-sources/
    ```

3. Install dependencies and extension modules:

    ```
    npm install
    ```

    Additional extension modules will now be available under `Neon-Firefox-<version>-sources/node_modules/neon-extension-*`

4. Build the extension

    ```
    npm run build
    ```

    The built extension will now be available under `Neon-Firefox-<version>-sources/build/production/`.
