import openpyxl, csv, sys, datetime as dt, os
from openpyxl.utils import column_index_from_string as ci
src=sys.argv[1]; out=sys.argv[2]; os.makedirs(out,exist_ok=True)
wb=openpyxl.load_workbook(src,data_only=True)
S=wb['Sheet2'];D=wb['DATA'];T=wb['통계'];B=wb['본스통계']
from openpyxl.utils import get_column_letter as gl
_lab={B.cell(1,c).value:c for c in range(1,B.max_column+1) if B.cell(1,c).value in ('평균','STD','평균+2STD','평균-2STD','STD60')}
OFF=[_lab['평균'],_lab['STD'],_lab['평균+2STD'],_lab['평균-2STD'],_lab['STD60']]  # 블록 시작 열 (평균 블록은 B열)
def bcol(m,blk): return gl(ci(m)-OFF[0]+OFF[blk])  # 평균 열 문자 -> 같은 지표의 다른 블록 열 문자
def num(x,r=2):
    if isinstance(x,bool) or not isinstance(x,(int,float)): return ''
    y=round(float(x),r); return int(y) if y==int(y) else y
def d(x): return x.strftime('%Y-%m-%d') if isinstance(x,(dt.datetime,dt.date)) else ''
def w(name,cols,rows):
    with open(f'{out}/{name}.csv','w',newline='',encoding='utf-8') as f:
        c=csv.writer(f); c.writerow(cols); c.writerows(rows)
# summary tables (transposed)
names1=['통안1/2','통안2/3','국고1/3','국고2/3','국고2/5','국고2/10','국고3/5','국고3/10','국고5/10','국고5/20','국고5/30','국고3/30','국고10/20','국고10/30','국고20/30','국고3/5/10','국고3/10/30','국고10/20/30']
grp1=['통안']*2+['국고 커브']*13+['국고 버터플라이']*3
names2=['본스 통안1Y','본스 통안1.5Y','본스 통안2Y','본스 통안3Y','본스 국고1Y','본스 국고1.5Y','본스 국고2Y','본스 국고3Y','본스 국고4Y','본스 국고5Y','본스 국고7Y','본스 국고10Y','국주 VS국고','국주 본스','은행채 1Y','은행채 1.5Y','은행채 2Y','은행채 3Y']
grp2=['본드스왑 통안']*4+['본드스왑 국고']*8+['국민주택']*2+['은행채 AAA SP']*4
rows=[]
for k,nm in enumerate(names1):
    g=lambda r: S.cell(r,3+k).value
    rows.append([grp1[k],nm,num(g(3)),num(g(4)),num(g(5)),num(g(6)),num(g(7)),num(g(8)),num(g(9))])
# block 2: 현재값은 Sheet2 13행, 통계값은 본스통계 시트에서 직접(엑셀 표 16~19행은 카드 열 삽입으로 참조가 밀려 있음)
asof=S['A13'].value; br=None
for r in range(3,B.max_row+1):
    if B.cell(r,1).value==asof: br=r; break
for k,nm in enumerate(names2):
    cur=S.cell(13,3+k).value
    st=lambda off: B.cell(br,off+k).value if br else None
    m=st(OFF[0]); diff=S.cell(15,3+k).value
    rows.append([grp2[k],nm,num(cur),num(m),num(diff),num(st(OFF[1])),num(st(OFF[2])),num(st(OFF[3])),num(st(OFF[4]))])
# 은행채 본드스왑 1Y: 현재값은 DATA CO열(기준일 행), 통계는 본스통계 W열 계열
for dr in range(14,300):
    if D.cell(dr,ci('AK')).value==asof: break
cur=D.cell(dr,ci('CO')).value; k=ci('W')-OFF[0]
st=lambda off: B.cell(br,off+k).value if br else None
m=st(OFF[0])
rows.append(['본드스왑 은행채','본스 은행채1Y',num(cur),num(m),num(cur-m) if isinstance(cur,(int,float)) and isinstance(m,(int,float)) else '',num(st(OFF[1])),num(st(OFF[2])),num(st(OFF[3])),num(st(OFF[4]))])
w('spread_tbl',['구분','스프레드','현재','평균6M','대비','표준편차6M','평균+2STD','평균-2STD','표준편차60D'],rows)
w('spread_asof',['기준일'],[[d(S['A3'].value)]])
# time series: (id, data col, stats sheet, mean col, up col, dn col)
spec=[('s1','AL',T,'B','AM','BF'),('s2','AM',T,'C','AN','BG'),('s3','AN',T,'D','AO','BH'),('s4','AO',T,'E','AP','BI'),
('s7','AR',T,'H','AS','BL'),('s8','AS',T,'I','AT','BM'),('s9','AT',T,'J','AU','BN'),('s10','AV',T,'L','AW','BP'),
('s11','AW',T,'M','AX','BQ'),('s12','AY',T,'O','AZ','BS'),('s13','BA',T,'Q','BB','BU'),('s14','BB',T,'R','BC','BV'),('s17','AX',T,'N','AY','BR')]
# 본스통계 계열: (id, DATA 열, 평균 열) -> +2STD/-2STD 열은 블록 위치로 계산
for sid,dc,m in [('s5','BD','B'),('s6','BF','D'),('s16','BP','N'),('s15','BX','P'),('s18','BY','Q'),('s19','BZ','R'),('s20','CA','S'),
                 ('s21','CH','T'),('s22','CI','U'),('s23','CJ','V'),('s28','CO','W')]:
    spec.append((sid,dc,B,m,bcol(m,2),bcol(m,3)))
spec+=[('s25','CL',None,None,None,None),('s26','CM',None,None,None,None),('s27','CN',None,None,None,None)]
cols=['일자']
for s in spec: cols+= [s[0]] if s[2] is None else [s[0],s[0]+'_m',s[0]+'_u',s[0]+'_d']
rows=[]
for i in range(243):
    dr=14+i; sr=4+i
    dt_=D.cell(dr,ci('AK')).value
    if not isinstance(dt_,(dt.datetime,dt.date)): break
    row=[d(dt_)]
    for sid,dc,st,m,u,dn in spec:
        row.append(num(D.cell(dr,ci(dc)).value))
        if st is not None: row+= [num(st.cell(sr,ci(m)).value),num(st.cell(sr,ci(u)).value),num(st.cell(sr,ci(dn)).value)]
    rows.append(row)
rows.reverse()
w('spread_ts',cols,rows)
print(d(S['A3'].value), len(rows))
