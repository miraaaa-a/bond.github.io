# 페이지 생성 방법
1. 엑셀 3개에서 CSV 추출 (추출 스크립트 A/B/C) → 한 폴더에 모음
2. `tools/bank_plan.csv` 를 같은 폴더에 복사 (은행채 일괄신고수량, 수동 관리)
3. `python3 tools/build.py <csv폴더> .` → `index.html` 생성
