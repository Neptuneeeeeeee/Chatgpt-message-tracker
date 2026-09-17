#!/usr/bin/env python3
"""Verify the current release against persisted test receipts and write a public-safe summary."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import zipfile

root = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--checks', type=Path, required=True)
parser.add_argument('--chrome', type=Path, required=True)
args = parser.parse_args()
sha = lambda b: hashlib.sha256(b).hexdigest()
version = json.loads((root / 'manifest.json').read_text())['version']
dist = root / 'dist' / version
checks = json.loads((args.checks / 'report.json').read_text())
chrome = json.loads((args.chrome / 'report.json').read_text())
audit = json.loads((dist / 'package-audit.json').read_text())
assert checks['pass'] and checks['version'] == version
assert checks['unit']['pass'] == checks['unit']['tests'] and not checks['unit']['fail']
assert chrome['pass'] and chrome['packagedExtensionTested']
assert chrome['browserExit'] == {'code': 0, 'signal': None}
assert chrome['runtimeErrors'] == [] and chrome['liveChatGPTAccountVerified'] is False
assert all(row['pass'] for row in chrome['tests'])
for name, digest in checks['sourceSHA256'].items():
    assert sha((root / name).read_bytes()) == digest, 'Changed since checks: ' + name
upload = dist / audit['uploadFile']
assert sha(upload.read_bytes()) == audit['sha256']
with zipfile.ZipFile(upload) as archive:
    assert archive.testzip() is None
    assert set(archive.namelist()) == set(audit['files'])
    assert 'manifest.json' in archive.namelist()
    for name, record in audit['files'].items():
        data = archive.read(name)
        assert data == (root / name).read_bytes() == (dist / 'unpacked' / name).read_bytes(), name
        assert sha(data) == record['sha256']
kit = dist / ('chatgpt-message-tracker-' + version + '-publish-kit.zip')
with zipfile.ZipFile(kit) as archive:
    assert archive.testzip() is None
    assert archive.read(upload.name) == upload.read_bytes()
    assert archive.read('MANUAL_TEST.md') == (root / ('docs/USER_TEST_' + version + '.md')).read_bytes()
profile = Path(json.loads((args.chrome / 'progress.json').read_text())['profile'])
assert not profile.exists(), 'Test profile not removed'
processes = subprocess.run(['ps','-axo','pid=,command='],capture_output=True,text=True,check=True).stdout
assert not any('--user-data-dir=' + str(profile) in line for line in processes.splitlines()), 'Test browser remains'
stderr = (args.chrome / 'chrome-stderr.log').read_text()
categories = {}
for match in re.finditer(r'ERROR:([^\]]+)', stderr):
    categories[match[1]] = categories.get(match[1], 0) + 1
subprocess.run(['git','diff','--check'],cwd=root,check=True)
report = {
    'version': version, 'pass': True, 'unitTests': checks['unit'],
    'staticChecks': checks['static'], 'languageCombinations': 21 * 21,
    'chromeScenarios': len(chrome['tests']), 'chromeLanguagePairs': chrome['languagePairsVerified'],
    'browser': chrome['browser']['product'], 'browserExit': chrome['browserExit'],
    'runtimeErrors': chrome['runtimeErrors'], 'browserNativeDiagnosticCategories': categories,
    'testProfileRemoved': True, 'liveChatGPTAccountVerified': False,
    'upload': audit, 'publishKit': {'file': kit.name, 'bytes': kit.stat().st_size, 'sha256': sha(kit.read_bytes())},
    'defaults': {'uiLanguage': 'en-US', 'modeLabelLanguage': 'en-US'},
    'sourceSHA256': checks['sourceSHA256'],
    'notes': ['Actual MV3 package loaded in isolated Chrome on a locally fulfilled test page.',
              'UI language and mode label language are independent from actual site detection.',
              'Interface translations are not all independently reviewed by native speakers.',
              'No personal account language changes, store submission, or Git push performed by this release workflow.']
}
(root / ('docs/release-' + version + '.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2) + '\n')
print(json.dumps({k:report[k] for k in ['version','pass','unitTests','chromeScenarios','chromeLanguagePairs','testProfileRemoved','browserNativeDiagnosticCategories','publishKit']},indent=2))
print('UPLOAD_SHA256', audit['sha256'])
