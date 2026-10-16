#!/usr/bin/env python3
"""原型自检：python3 tools/check.py          检查
            python3 tools/check.py --bump   把所有页面的 css/js 版本号统一换成新的（改过 css/js 后用）

有错误时退出码为 1；“提示”不影响退出码。
"""
import datetime
import glob
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

PAGES = sorted(glob.glob("*.html"))
SCRIPTS = sorted(glob.glob("js/*.js"))
STYLES = sorted(glob.glob("css/*.css"))
ASSET_REF = re.compile(r'((?:css|js)/[\w.-]+\.(?:css|js))(\?v=[\w.-]+)?(?=["\'])')
# 脚本里拼接出来的类名前缀，例如 "is-" + state、"asset-" + kind
DYNAMIC_CLASS = re.compile(r"^(is|asset)-")


def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def bump():
    version = datetime.datetime.now().strftime("%Y%m%d%H%M")
    for page in PAGES:
        text = read(page)
        new = ASSET_REF.sub(lambda m: m.group(1) + "?v=" + version, text)
        if new != text:
            with open(page, "w", encoding="utf-8") as f:
                f.write(new)
    print("版本号已统一为 v=" + version)


def check_page_scripts(page, sources, errors):
    """脚本按 id 取的元素要在这一页存在；同一页加载的脚本之间不能重名定义全局函数。"""
    html = sources[page]
    files = [m.group(1) for m in re.finditer(r'<script src="(js/[\w.-]+\.js)', html)]
    inline = "".join(re.findall(r"<script>(.*?)</script>", html, flags=re.S))
    scripts = [(f, sources.get(f, "")) for f in files] + ([(page + " 内联脚本", inline)] if inline.strip() else [])
    js = "".join(text for _, text in scripts)
    known = set(re.findall(r'\sid="([^"]+)"', html)) | set(re.findall(r'id=\\?["\']([\w-]+)', js))
    known |= set(re.findall(r'\.id\s*=\s*["\']([\w-]+)', js))
    for name, text in scripts:
        refs = re.findall(r'(?:getElementById|\$id)\(\s*["\']([\w-]+)["\']\s*\)', text)
        refs += re.findall(r'querySelector(?:All)?\(\s*["\']#([\w-]+)["\' .:\[>]', text)
        missing = sorted(set(refs) - known)
        if missing:
            errors.append(page + " 的 " + name + " 引用了页面里不存在的 id：" + "、".join(missing))
    defined = {}
    for name, text in scripts:
        for fn, var in re.findall(r"^(?:function\s+([\w$]+)\s*\(|var\s+([\w$]+))", text, flags=re.M):
            defined.setdefault(fn or var, []).append(name)
    for fn, where in sorted(defined.items()):
        if len(where) > 1:
            errors.append(page + " 的全局变量或函数 " + fn + " 定义了多次，后加载的会覆盖前面的：" + "、".join(where))


def main():
    if "--bump" in sys.argv:
        bump()

    errors, notes = [], []
    sources = {p: read(p) for p in PAGES + SCRIPTS}
    css_text = "".join(read(p) for p in STYLES)
    code = "".join(sources.values())

    versions = {}
    for page in PAGES:
        text = sources[page]
        for m in re.finditer(r'(?:src|href)="([^"#?]+)(?:\?[^"]*)?"', text):
            ref = m.group(1)
            if re.match(r"^(https?:|mailto:|data:|javascript:|//)", ref) or not ref.strip():
                continue
            if not os.path.exists(ref):
                errors.append(page + " 引用的文件不存在：" + ref)
        for m in ASSET_REF.finditer(text):
            if not m.group(2):
                errors.append(page + " 引用 " + m.group(1) + " 时没带版本号 ?v=")
            versions.setdefault(m.group(2) or "(无)", []).append(page + " → " + m.group(1))
        ids = re.findall(r'\sid="([^"]+)"', re.sub(r"<script.*?</script>", "", text, flags=re.S))
        dupes = sorted({i for i in ids if ids.count(i) > 1})
        if dupes:
            errors.append(page + " 有重复的 id：" + "、".join(dupes))
    if len(versions) > 1:
        detail = "；".join(v + "：" + "、".join(refs[:3]) + ("…" if len(refs) > 3 else "") for v, refs in versions.items())
        errors.append("各页面 css/js 版本号不一致，运行 python3 tools/check.py --bump 统一。" + detail)

    for path in sorted(set(re.findall(r"media/[\w/.-]+\.(?:png|jpe?g|webp|gif|mp4|svg)", code + css_text))):
        if not os.path.exists(path):
            errors.append("引用的媒体不存在：" + path)

    for path in sorted(glob.glob("media/**/*.*", recursive=True)):
        if path.replace(os.sep, "/") not in code + css_text:
            notes.append("没有页面使用的媒体：" + path)

    for page in PAGES:
        check_page_scripts(page, sources, errors)

    css_body = re.sub(r"\{[^{}]*\}", "{}", re.sub(r"/\*.*?\*/", "", css_text, flags=re.S))
    tokens = set(re.findall(r"[.#]([A-Za-z_][\w-]*)", css_body))
    unused = sorted(t for t in tokens
                    if not DYNAMIC_CLASS.match(t) and not re.search(r"(?<![\w-])" + re.escape(t) + r"(?![\w-])", code))
    if unused:
        notes.append("CSS 里没有页面用到的类名/ID（可考虑删除）：" + " ".join(unused))

    for line in errors:
        print("错误  " + line)
    for line in notes:
        print("提示  " + line)
    print("检查完成：%d 个错误，%d 条提示" % (len(errors), len(notes)))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
