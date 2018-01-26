#!/usr/bin/env python
import json
import os
import subprocess
import sys
import urllib2


PACKAGE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))


def install_modules(branch):
    # Try install modules
    for name in list_modules():
        try:
            code = install_module(name, branch)
        except Exception as ex:
            print '[NeApp/%s] Exception raised: %s\n' % (name, ex)
            continue

        # Process error returned
        if code != 0:
            print '[NeApp/%s] Exited with return code: %s\n' % (name, code)
            continue

        # Module installed
        print '[NeApp/%s] Installed\n' % (name,)


def install_module(name, current_branch):
    for branch in [current_branch, 'develop', 'master']:
        if not module_exists(name, branch):
            continue

        print '[NeApp/%s#%s] Installing...' % (name, branch)

        # Install module
        return subprocess.call([
            'npm', 'install',
            'NeApp/%s#%s' % (name, branch)
        ])


def module_exists(name, branch):
    request = urllib2.Request('https://github.com/NeApp/%s/tree/%s' % (name, branch))
    request.get_method = lambda: 'HEAD'

    # Request branch page
    try:
        response = urllib2.urlopen(request)
    except:
        return False

    # Ensure branch exists
    return 200 <= response.getcode() <= 300


def list_modules():
    with open(os.path.join(PACKAGE_DIR, 'package.json')) as fp:
        package = json.load(fp)

    for name in package.get('dependencies', {}):
        if not name.startswith('neon-extension-'):
            continue

        yield name


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print 'USAGE: install_modules.py BRANCH'
        sys.exit(1)

    install_modules(sys.argv[1])
