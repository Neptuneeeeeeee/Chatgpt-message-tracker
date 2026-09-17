#!/usr/bin/env python3
"""Build auditable, byte-reproducible Chrome Web Store ZIPs. Python standard library only.

The allowlist is deliberately explicit: tests, development dependencies, credentials,
raw website bundles, and user/browser data can never enter an upload by directory recursion.
ZIP_STORED avoids platform/zlib differences; this extension is small enough not to need compression.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import struct
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parent.parent
FILES = [
    'manifest.json',
    'icons/icon-16.png', 'icons/icon-32.png', 'icons/icon-48.png', 'icons/icon-128.png',
    'src/background.js', 'src/shared.js', 'src/site-locales.js', 'src/site-detection.js',
    'src/content.js', 'src/content.css', 'src/popup.html', 'src/popup.js', 'src/popup.css',
    'src/options.html', 'src/options.js', 'src/options.css',
]
ASSETS = ['icon-128.png', 'promo-440x280.jpg', 'screenshot-01-1280x800.jpg', 'screenshot-02-1280x800.jpg']


def digest(data):
    return hashlib.sha256(data).hexdigest()


def safe_bytes(relative):
    p = ROOT / relative
    if p.is_symlink() or not p.is_file() or not p.resolve().is_relative_to(ROOT):
        raise ValueError('Not a regular release file: ' + relative)
    return p.read_bytes()


def write_zip(destination, contents):
    with zipfile.ZipFile(destination, 'w', compression=zipfile.ZIP_STORED) as archive:
        for name, data in sorted(contents.items()):
            if name.startswith('/') or '..' in Path(name).parts:
                raise ValueError('Unsafe archive member: ' + name)
            entry = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
            entry.create_system = 3
            entry.external_attr = 0o100644 << 16
            archive.writestr(entry, data)
    with zipfile.ZipFile(destination) as archive:
        if archive.testzip() is not None:
            raise ValueError('ZIP CRC validation failed')
        if set(archive.namelist()) != set(contents):
            raise ValueError('ZIP member mismatch')
        for name, data in contents.items():
            if archive.read(name) != data:
                raise ValueError('ZIP round-trip mismatch: ' + name)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--extension-only', action='store_true', help='Prepare the upload and unpacked directory before screenshot capture.')
    parser.add_argument('--output', type=Path, help='Default: dist/<manifest version>')
    args = parser.parse_args()
    manifest = json.loads(safe_bytes('manifest.json'))
    version = manifest['version']
    if not re.fullmatch(r'\d+(?:\.\d+){0,3}', version):
        raise ValueError('Invalid manifest version')
    if not 1 <= len(manifest['description']) <= 132:
        raise ValueError('Description must have 1–132 characters')
    if manifest['manifest_version'] != 3 or manifest['permissions'] != ['storage', 'scripting']:
        raise ValueError('Unexpected manifest permissions or version')
    if manifest['host_permissions'] != ['https://chatgpt.com/*', 'https://chat.openai.com/*']:
        raise ValueError('Unexpected host permissions')
    output = args.output.resolve() if args.output else ROOT / 'dist' / version
    output.mkdir(parents=True, exist_ok=True)
    contents = {name: safe_bytes(name) for name in FILES}
    for size, name in manifest['icons'].items():
        png = contents[name]
        if png[:8] != b'\x89PNG\r\n\x1a\n' or struct.unpack('>II', png[16:24]) != (int(size), int(size)):
            raise ValueError('Icon dimensions mismatch: ' + name)
    required = [manifest['background']['service_worker'], manifest['action']['default_popup'], manifest['options_page']]
    for group in manifest['content_scripts']:
        required.extend(group['js'] + group['css'])
    for name in required:
        if name not in contents:
            raise ValueError('Manifest reference omitted: ' + name)
    for name in ['src/options.html', 'src/popup.html']:
        for relative in re.findall(r'(?:src|href)="([^"#:]+)"', contents[name].decode()):
            if '://' not in relative and str(Path(name).parent / relative) not in contents:
                raise ValueError('Local page reference omitted: ' + relative)
    for name, data in contents.items():
        if name.endswith(('.js', '.html', '.json', '.css')):
            text = data.decode('utf-8')
            if '/Users/' in text or '/private/tmp/' in text:
                raise ValueError('Host-specific path in runtime: ' + name)
    stem = 'chatgpt-message-tracker-' + version
    upload = output / (stem + '-chrome-web-store.zip')
    write_zip(upload, contents)
    # A dedicated generated directory; do not remove arbitrary existing directories.
    stage = output / 'unpacked'
    marker = output / '.cmt-generated-stage'
    if stage.exists():
        if not marker.exists():
            raise ValueError('Refusing to replace unmarked directory: ' + str(stage))
        shutil.rmtree(stage)
    stage.mkdir()
    marker.write_text('Generated by tools/build_release.py\n')
    for name, data in contents.items():
        target = stage / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    audit = {
        'version': version, 'uploadFile': upload.name, 'sha256': digest(upload.read_bytes()),
        'bytes': upload.stat().st_size, 'fileCount': len(contents), 'manifestAtRoot': True,
        'zipRoundTripVerified': True, 'runtimeOnlyAllowlist': True,
        'permissions': manifest['permissions'], 'hostPermissions': manifest['host_permissions'],
        'files': {n: {'bytes': len(b), 'sha256': digest(b)} for n, b in sorted(contents.items())},
    }
    audit_bytes = (json.dumps(audit, ensure_ascii=False, indent=2) + '\n').encode()
    (output / 'package-audit.json').write_bytes(audit_bytes)
    sums = [(digest(upload.read_bytes()), upload.name)]
    if not args.extension_only:
        materials = {upload.name: upload.read_bytes(), 'package-audit.json': audit_bytes, 'PRIVACY.md': safe_bytes('PRIVACY.md')}
        for name in ['PUBLISHING.md', 'listing-zh-CN.md', 'listing-en.md']:
            materials[name] = safe_bytes('store/' + name)
        for name in ASSETS:
            materials['assets/' + name] = safe_bytes('store/assets/' + name)
        kit = output / (stem + '-publish-kit.zip')
        write_zip(kit, materials)
        sums.append((digest(kit.read_bytes()), kit.name))
    (output / 'SHA256SUMS.txt').write_text(''.join(h + '  ' + n + '\n' for h, n in sums))
    print(json.dumps({'output': str(output), 'upload': upload.name, 'bytes': audit['bytes'], 'files': len(contents), 'sha256': audit['sha256'], 'fullPublishKit': not args.extension_only}, indent=2))


if __name__ == '__main__':
    main()
