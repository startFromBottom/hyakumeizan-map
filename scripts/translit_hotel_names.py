"""
호텔 영문 이름 → 한국어 음역.

전략:
1. 호텔 체인·일반 명사·접속사는 사전 매핑 (외래어 표기법 기반)
2. 그 외 단어는 헵번식 로마자(Hepburn) → 한글 음가 변환
3. 결과를 lodgings.geojson 의 properties.name_ko에 저장 (idempotent)

커버리지: name_en이 있는 558개 호텔
"""
import json, re, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ── 사전 매핑 (소문자 키)
DICT = {
    # 일반 명사
    'hotel': '호텔', 'inn': '인', 'ryokan': '료칸', 'hostel': '호스텔',
    'lodge': '롯지', 'house': '하우스', 'pension': '펜션', 'guest': '게스트',
    'guesthouse': '게스트하우스', 'resort': '리조트', 'spa': '스파',
    'onsen': '온천', 'minshuku': '민슈쿠', 'youth': '유스',
    'station': '역', 'ekimae': '에키마에', 'mae': '마에',
    'annex': '별관', 'main': '본관', 'plaza': '플라자',
    'view': '뷰', 'park': '파크', 'center': '센터', 'centre': '센터',
    'tower': '타워', 'palace': '팰리스', 'royal': '로얄',
    'grand': '그랜드', 'garden': '가든', 'forest': '포레스트', 'lake': '레이크',
    'mountain': '마운틴', 'sea': '시', 'sky': '스카이', 'sun': '선',
    'star': '스타', 'business': '비즈니스', 'world': '월드',
    'green': '그린', 'blue': '블루', 'red': '레드', 'white': '화이트',
    'gold': '골드', 'silver': '실버',
    'no': '의', 'and': '앤', '&': '앤',
    'fish': '피쉬', 'owl': '아울', 'observatory': '관측소',
    'cottage': '코티지', 'backpackers': '백패커스', 'village': '빌리지',
    'farm': '팜', 'hops': '홉스', 'youth': '유스', 'phottage': '포티지',
    'popular': '파퓰러', 'popura': '포푸라', 'home': '홈',
    'tabi': '타비', 'tabi-tsumugi': '타비쓰무기', 'biei': '비에이',
    # 호텔 체인 (정확 표기)
    'toyoko': '도요코', 'apa': 'APA', 'dormy': '도미',
    'route': '루트', 'route-inn': '루트인', 'routeinn': '루트인',
    'comfort': '컴포트', 'richmond': '리치먼드', 'smile': '스마일',
    'super': '슈퍼', 'daiwa': '다이와', 'roynet': '로이넷',
    'hoshino': '호시노', 'mystays': '마이스테이즈', 'mystay': '마이스테이',
    'okura': '오쿠라', 'nikko': '닛코', 'prince': '프린스',
    'manten': '만텐', 'wing': '윙', 'dormy-inn': '도미인',
    'b-': 'B-', 'akari': '아카리',
    # 지명 (자주 등장)
    'tokyo': '도쿄', 'kyoto': '교토', 'osaka': '오사카', 'sapporo': '삿포로',
    'nagoya': '나고야', 'fukuoka': '후쿠오카', 'sendai': '센다이',
    'aomori': '아오모리', 'asahikawa': '아사히카와', 'yamagata': '야마가타',
    'kanazawa': '가나자와', 'niseko': '니세코', 'hakuba': '하쿠바',
    'shari': '샤리', 'rishiri': '리시리', 'kiyosato': '기요사토',
    'shiretoko': '시레토코', 'higashiyama': '히가시야마', 'ito': '이토',
    'ibusuki': '이부스키', 'matsumoto': '마쓰모토', 'nikko-': '닛코',
    'utsunomiya': '우쓰노미야', 'morioka': '모리오카', 'hakodate': '하코다테',
    'fuji': '후지', 'mt.': '산', 'mt': '산',
    'tateyama': '다테야마', 'yumoto': '유모토',
    'lake': '레이크',
    'ichinoya': '이치노야', 'kamoshika': '가모시카',
}

# ── 로마자 → 한글 음가 (헵번식 기반, 단순화)
# 두 글자(요음/촉음) 우선 매핑 → 한 글자 fallback
ROMAJI_LONG = {
    'kya': '캬', 'kyu': '큐', 'kyo': '쿄',
    'sha': '샤', 'shu': '슈', 'sho': '쇼', 'shi': '시',
    'cha': '챠', 'chu': '츄', 'cho': '쵸', 'chi': '치',
    'tsu': '쓰', 'tsa': '쓰', 'tsi': '쓰', 'tse': '쓰', 'tso': '쓰',
    'nya': '냐', 'nyu': '뉴', 'nyo': '뇨',
    'hya': '햐', 'hyu': '휴', 'hyo': '효',
    'mya': '먀', 'myu': '뮤', 'myo': '묘',
    'rya': '랴', 'ryu': '류', 'ryo': '료',
    'gya': '갸', 'gyu': '규', 'gyo': '교',
    'jya': '쟈', 'jyu': '쥬', 'jyo': '죠',
    'bya': '뱌', 'byu': '뷰', 'byo': '뵤',
    'pya': '퍄', 'pyu': '퓨', 'pyo': '표',
    'dzu': '즈', 'fu': '후', 'shu': '슈',
}
ROMAJI_2 = {
    # 자음 + 모음
    'ka': '카','ki': '키','ku': '쿠','ke': '케','ko': '코',
    'ga': '가','gi': '기','gu': '구','ge': '게','go': '고',
    'sa': '사','si': '시','su': '스','se': '세','so': '소',
    'za': '자','zi': '지','zu': '즈','ze': '제','zo': '조',
    'ta': '타','ti': '치','tu': '쓰','te': '테','to': '토',
    'da': '다','di': '지','du': '즈','de': '데','do': '도',
    'na': '나','ni': '니','nu': '누','ne': '네','no': '노',
    'ha': '하','hi': '히','hu': '후','he': '헤','ho': '호',
    'ba': '바','bi': '비','bu': '부','be': '베','bo': '보',
    'pa': '파','pi': '피','pu': '푸','pe': '페','po': '포',
    'ma': '마','mi': '미','mu': '무','me': '메','mo': '모',
    'ya': '야','yu': '유','yo': '요',
    'ra': '라','ri': '리','ru': '루','re': '레','ro': '로',
    'wa': '와','wo': '오',
    'ja': '자','ji': '지','ju': '주','je': '제','jo': '조',
    # 장음 (Hepburn ō, ū)
    'ou': '오','uu': '우','ee': '에','aa': '아','ii': '이',
}
ROMAJI_1 = {
    'a':'아','i':'이','u':'우','e':'에','o':'오','n':'ㄴ',
}

VOWELS = set('aeiou')

# f/v/l 같은 영어식 자음의 fallback (가장 가까운 일본어식 음가)
ENG_FALLBACK = {
    'f': '후',   # 일본어 fu 형태가 가장 흔함 (단독 f는 거의 없음)
    'v': '브',
    'l': '르',
    'q': '쿠',
    'x': '크스',
    # r 단독은 ru로
}

def compose_with_jongseong(prev_char, jongseong):
    """이전 글자에 받침(jongseong) 합성. 'ㄴ'/'ㅅ' 등.
    한글 음절 = (초성 * 588) + (중성 * 28) + 종성. 종성 0=받침없음.
    초성 19개, 중성 21개, 종성 28개."""
    JONGSEONG_MAP = {'ㄴ': 4, 'ㅅ': 19, 'ㄱ': 1, 'ㅁ': 16, 'ㅇ': 21, 'ㄹ': 8, 'ㅂ': 17}
    if not prev_char or len(prev_char) != 1: return None
    code = ord(prev_char)
    if not (0xAC00 <= code <= 0xD7A3): return None  # 한글 음절 아님
    base = code - 0xAC00
    if base % 28 != 0: return None  # 이미 받침 있으면 합성 안 함
    j = JONGSEONG_MAP.get(jongseong)
    if j is None: return None
    return chr(0xAC00 + base + j)

def romaji_to_hangul(word):
    """일본어 로마자 한 단어 → 한글. 받침 합성 포함."""
    s = word.lower()
    out = []
    i = 0
    def append_jongseong(j):
        """직전 글자에 받침 합성. 합성 실패하면 별도 음절로."""
        if out:
            composed = compose_with_jongseong(out[-1], j)
            if composed:
                out[-1] = composed
                return
        # fallback — 별도 음절
        if j == 'ㄴ': out.append('ㄴ')
        elif j == 'ㅅ': out.append('ㅅ')
        else: out.append(j)

    while i < len(s):
        # 3글자 (요음 등)
        if i+3 <= len(s) and s[i:i+3] in ROMAJI_LONG:
            out.append(ROMAJI_LONG[s[i:i+3]]); i += 3; continue
        # 촉음 (자음 중복, 단 nn 제외) → 받침 ㅅ을 직전 글자에
        if i+1 < len(s) and s[i] not in VOWELS and s[i] == s[i+1] and s[i] not in ('n',):
            append_jongseong('ㅅ')
            i += 1; continue
        # 2글자
        if i+2 <= len(s) and s[i:i+2] in ROMAJI_2:
            out.append(ROMAJI_2[s[i:i+2]]); i += 2; continue
        # n 받침
        if s[i] == 'n' and (i+1 >= len(s) or s[i+1] not in VOWELS):
            append_jongseong('ㄴ')
            i += 1; continue
        # 영어식 자음 fallback (f, v, l, q, x)
        if s[i] in ENG_FALLBACK and (i+1 >= len(s) or s[i+1] not in VOWELS):
            out.append(ENG_FALLBACK[s[i]])
            i += 1; continue
        # f + 모음 처리: fa/fi/fe/fo는 후+모음 흉내, fu는 이미 ROMAJI_LONG에
        if s[i] == 'f' and i+1 < len(s) and s[i+1] in VOWELS:
            v = s[i+1]
            out.append({'a':'파','i':'피','e':'페','o':'포','u':'후'}[v])
            i += 2; continue
        if s[i] == 'v' and i+1 < len(s) and s[i+1] in VOWELS:
            v = s[i+1]
            out.append({'a':'바','i':'비','e':'베','o':'보','u':'부'}[v])
            i += 2; continue
        if s[i] == 'l' and i+1 < len(s) and s[i+1] in VOWELS:
            v = s[i+1]
            out.append({'a':'라','i':'리','e':'레','o':'로','u':'루'}[v])
            i += 2; continue
        # 1글자
        if s[i] in ROMAJI_1:
            out.append(ROMAJI_1[s[i]]); i += 1; continue
        # 모르는 글자 — 그냥 통과
        out.append(s[i]); i += 1
    return ''.join(out)

def translit_word(word):
    """단어 하나를 한국어로 변환. 사전 우선, 그 다음 로마자 변환."""
    if not word: return ''
    w = word.strip()
    if not w: return ''
    low = w.lower()
    # 숫자/특수문자
    if not re.search(r'[a-zA-Z]', w):
        return w
    # 사전
    if low in DICT:
        return DICT[low]
    # 하이픈으로 분리된 경우 재귀
    if '-' in w:
        return '-'.join(translit_word(p) for p in w.split('-'))
    # 로마자 변환 시도
    return romaji_to_hangul(w)

def translit_phrase(en):
    """문장 전체 변환 — 단어 단위로 처리, 공백 유지."""
    # ',' 등 분리자 보존
    parts = re.split(r'(\s+|,|\.)', en)
    out = []
    for p in parts:
        if re.match(r'\s+|,|\.', p):
            out.append(p)
        else:
            out.append(translit_word(p))
    return ''.join(out).strip()

def main():
    path = os.path.join(ROOT, 'public/data/lodgings.geojson')
    data = json.load(open(path))
    updated = 0
    skipped = 0
    for f in data['features']:
        p = f['properties']
        en = (p.get('name_en') or '').strip()
        existing_kr = (p.get('name_ko') or '').strip()
        # 일본어 원문 자체에 한국어가 있으면 skip
        name = p.get('name','')
        if name and re.search(r'[가-힯]', name):
            skipped += 1; continue
        if not en:
            continue
        kr = translit_phrase(en)
        # 의미있는 변환만 (영어가 그대로 남았으면 패스)
        if not re.search(r'[가-힯]', kr):
            continue
        # 변환 결과에 알파벳이 25%↑ 남아있으면 자연스럽지 않으니 skip
        alpha = len(re.findall(r'[A-Za-z]', kr))
        total = len(re.sub(r'\s|,|\.|-', '', kr))
        if total and alpha / total > 0.25:
            continue
        # ㅅ/ㄴ 단독 자모가 남아있으면 음절 깨진 거 — skip
        if re.search(r'[ㄱ-ㅎ]', kr):
            continue
        p['name_ko'] = kr
        updated += 1

    json.dump(data, open(path, 'w'), ensure_ascii=False, indent=2)
    print(f'✓ Updated: {updated} hotels (한국어 변환)')
    print(f'  Skipped (이미 한국어): {skipped}')

    # 샘플 출력
    print('\n샘플 (앞 20개 변환 결과):')
    cnt = 0
    for f in data['features']:
        p = f['properties']
        kr = p.get('name_ko')
        if kr and p.get('name_en'):
            print(f"  {p['name']:30s} | {p['name_en']:50s} → {kr}")
            cnt += 1
            if cnt >= 20: break

if __name__ == '__main__':
    main()
