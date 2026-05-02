"""
산별 사진 3장 재수집 (위키피디아 본문 이미지 기반).
hyakumeizan_full.json의 images 필드만 갱신.
"""
import json, urllib.request, urllib.parse, time, sys, re, os

WP_API = "https://ja.wikipedia.org/w/api.php"
UA = "hyakumeizan-map-bot/1.0 (+https://github.com/startFromBottom/hyakumeizan-map)"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

EXCLUDE = re.compile(
    r'(commons-logo|wikinews|wiktionary|wikidata-logo|wikiquote|wikisource|'
    r'edit.icon|disambig|ambox|info_icon|warning|nuvola|emblem|symbol|'
    r'flag.*\.svg|crystal|pog\.svg|relief|osm_compass|osm_logo|wikimedia|'
    r'qsicon|\.svg$)', re.I)

def http_get(url, params=None, timeout=30):
    if params:
        url = url + '?' + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)

def get_page_images(title):
    try:
        d = http_get(WP_API, {'action':'parse','page':title,'prop':'images','format':'json','redirects':'1'})
        files = d.get('parse', {}).get('images', [])
        out = []
        for f in files:
            if EXCLUDE.search(f): continue
            if not re.search(r'\.(jpg|jpeg|png|tif|tiff|webp)$', f, re.I): continue
            out.append(f.replace(' ', '_'))
        return out
    except Exception:
        return []

def commons_filepath(filename, w=800):
    qf = urllib.parse.quote(filename.replace(' ', '_'), safe='')
    return f"https://commons.wikimedia.org/wiki/Special:FilePath/{qf}?width={w}"

def commons_page(filename):
    qf = urllib.parse.quote(filename.replace(' ', '_'), safe='')
    return f"https://commons.wikimedia.org/wiki/File:{qf}"

def main():
    path = os.path.join(ROOT, 'web/public/data/hyakumeizan_full.json')
    data = json.load(open(path))
    changed = 0
    for m in data:
        ja_url = (m.get('wikipedia') or {}).get('ja') or ''
        if not ja_url: continue
        title = urllib.parse.unquote(ja_url.split('/wiki/')[-1])
        files = get_page_images(title)
        primary = (m.get('image') or {}).get('filename')
        primary_norm = primary.replace(' ', '_') if primary else None
        gallery = []
        if primary_norm: gallery.append(primary_norm)
        for f in files:
            if f in gallery: continue
            gallery.append(f)
            if len(gallery) >= 3: break
        gallery = gallery[:3]
        new_imgs = [{
            'filename': f,
            'thumb': commons_filepath(f, 800),
            'large': commons_filepath(f, 1600),
            'commons': commons_page(f),
        } for f in gallery]
        if json.dumps(m.get('images') or []) != json.dumps(new_imgs):
            m['images'] = new_imgs
            changed += 1
        print(f"  [{m['no']:3d}] {m['name_ja']:20s} → {len(new_imgs)} photos", flush=True)
        time.sleep(0.3)
    json.dump(data, open(path, 'w'), ensure_ascii=False, indent=2)
    print(f"\n✓ Photos refreshed; {changed} mountains had updates")

if __name__ == '__main__':
    main()
