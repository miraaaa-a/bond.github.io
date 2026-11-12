import openpyxl, csv, sys, re, datetime as dt, os
src=sys.argv[1]; out=sys.argv[2]; os.makedirs(out,exist_ok=True)
wb=openpyxl.load_workbook(src,data_only=True)
def n(x,r=1):
    if x is None or x=='': return ''
    if isinstance(x,(int,float)):
        y=round(float(x),r); return int(y) if y==int(y) else y
    return x
def d(x): return x.strftime('%Y-%m-%d') if isinstance(x,(dt.datetime,dt.date)) else x
def w(name,cols,rows):
    with open(f'{out}/{name}.csv','w',newline='',encoding='utf-8') as f:
        c=csv.writer(f); c.writerow(cols); c.writerows(rows)
# month sheet: current YYYY.MM if present, else latest
msheets=[s for s in wb.sheetnames if re.fullmatch(r'\d{4}\.\d{1,2}',s)]
key=lambda s:(int(s.split('.')[0]),int(s.split('.')[1]))
today=(dt.datetime.utcnow()+dt.timedelta(hours=9)).date(); cur=f"{today.year}.{today.month:02d}"
ms=cur if cur in msheets else max(msheets,key=key)
ys=ms.split('.')[0]
# year sheet
ws=wb[ys]; hdr=[c.value for c in ws[3]]
cols=[(i,h) for i,h in enumerate(hdr) if i>=2 and h]
rows=[];mon=None
for r in ws.iter_rows(min_row=4,values_only=True):
    if r[0]: mon=r[0]
    if not r[1]: continue
    rows.append([mon,r[1],*[n(r[i]) for i,_ in cols]])
w('bank_year',['월','구분',*[h for _,h in cols]],rows)
# month sheet
ws=wb[ms]; hdr=[c.value for c in ws[3]]
bcols=[(i,h) for i,h in enumerate(hdr) if i>=1 and h]
asof=None
for row in ws.iter_rows(min_row=1,max_row=3):
    for c in row:
        if c.value=='기준일': asof=ws.cell(c.row,c.column+1).value
daily=[];summ={}
for r in ws.iter_rows(min_row=4,values_only=True):
    if isinstance(r[0],(dt.datetime,dt.date)):
        daily.append([d(r[0]),*[n(r[i]) for i,_ in bcols]])
    elif r[0] in ('만기도래액 합산','당월 누적발행액','발행 진도율'):
        summ[r[0]]=[r[i] for i,_ in bcols]
w('bank_month_daily',['일자',*[h for _,h in bcols]],daily)
banks=[h for _,h in bcols]
rows=[]
for k,h in enumerate(banks):
    m=summ.get('만기도래액 합산',[None]*len(banks))[k]; i=summ.get('당월 누적발행액',[None]*len(banks))[k]; p=summ.get('발행 진도율',[None]*len(banks))[k]
    rows.append([h,n(m),n(i),n(p,4) if isinstance(p,(int,float)) else ''])
w('bank_month_sum',['은행','만기도래액','누적발행액','발행진도율'],rows)
grp=[]
for row in ws.iter_rows():
    for c in row:
        if c.value in ('특은 합산','시은 합산'):
            vals={}
            for rr in range(c.row+1,c.row+4):
                lab=ws.cell(rr,c.column).value; val=ws.cell(rr,c.column+1).value
                vals[lab]=val
            grp.append([c.value.replace(' 합산',''),n(vals.get('만기도래액')),n(vals.get('누적발행액')),n(vals.get('발행진도율'),4)])
w('bank_month_group',['구분','만기도래액','누적발행액','발행진도율'],grp)
w('bank_asof',['기준일','연도시트','월시트'],[[d(asof),ys,ms]])
print(ms,ys,asof)
# 기타데이터 시트 → 시장 지표 (기준일 = bank_asof 기준일)
if '기타데이터' in wb.sheetnames:
    ws=wb['기타데이터']
    def series(dcol,vcol):
        out=[]
        for r in range(4,ws.max_row+1):
            dv=ws[f'{dcol}{r}'].value; vv=ws[f'{vcol}{r}'].value
            if not isinstance(dv,(dt.datetime,dt.date)): break
            if isinstance(vv,(int,float)): out.append((dv.date() if isinstance(dv,dt.datetime) else dv, float(vv)))
        out.sort(); return out
    ad=asof.date() if isinstance(asof,dt.datetime) else asof
    spec=[('국고 3년','I','K','bp'),('국고 10년','I','M','bp'),('국고 30년','I','N','bp'),
          ('3선','A','B','틱'),('10선','E','F','틱'),('미 2Y','P','Q','bp'),('미 10Y','R','S','bp'),
          ('WTI','Y','Z','%'),('코스피','U','V','%')]
    rows=[]
    for name,dc,vc,unit in spec:
        s=[x for x in series(dc,vc) if x[0]<=ad]
        if len(s)<2: continue
        (d1,v1),(d0,v0)=s[-1],s[-2]
        closed = d1!=ad
        chg = (v1-v0)*100 if unit in ('bp','틱') else (v1/v0-1)*100
        rows.append([name,d1.strftime('%Y-%m-%d'),round(v1,4),d0.strftime('%Y-%m-%d'),round(v0,4),round(chg,2),unit,'Y' if closed else ''])
    w('market',['지표','일자','값','전일','전일값','변화','단위','휴장'],rows)
