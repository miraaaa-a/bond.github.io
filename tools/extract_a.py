import openpyxl, csv, sys, datetime as dt
src=sys.argv[1]; out=sys.argv[2]
wb=openpyxl.load_workbook(src,data_only=True)
ws=wb['Daily_수급']
v=lambda a: ws[a].value
def d(x): return x.strftime('%Y-%m-%d') if isinstance(x,(dt.datetime,dt.date)) else x
def n(x,r=4):
    if x is None or x=='': return ''
    if isinstance(x,(int,float)):
        y=round(float(x),r)
        return int(y) if y==int(y) else y
    return x
def w(name,cols,rows):
    with open(f'{out}/{name}.csv','w',newline='',encoding='utf-8') as f:
        c=csv.writer(f); c.writerow(cols); c.writerows(rows)
# asof
w('asof',['기준일','전일','전주','전월','주간시작','주간끝'],
  [[d(v('K2')),d(v('M2')),d(v('O2')),d(v('Q2')),v('K44').split(' ')[-3] if v('K44') else '',v('K44').split(' ')[-1] if v('K44') else '']])
# deposits
dep=[];hist=[]
grp={8:'은행',9:'은행',10:'은행',13:'증권',14:'자산운용',15:'자산운용',16:'자산운용',17:'자산운용'}
for r,g in grp.items():
    it=v(f'C{r}'); base=v('D7') if r<=10 else v('D12')
    dep.append([g,it,d(base),n(v(f'D{r}'),1),n(v(f'E{r}'),1),n(v(f'F{r}'),1),n(v(f'G{r}'),1)])
    hr=7 if r<=10 else 12
    for i,col in enumerate('HIJKL'):
        m=v(f'{col}{hr}')
        hist.append([it,i+1,f"{m.month}월말",d(m),n(v(f'{col}{r}'),1)])
w('deposit',['구분','항목','기준일','잔액','전일비','전주비','전월비'],dep)
w('deposit_hist',['항목','순서','월','일자','잔액'],hist)
# ktbf investors
rows=[]
for r in range(23,29):
    rows.append(['KTBF',v(f'B{r}'),*[n(v(f'{c}{r}'),0) for c in 'CDEFGHI']])
    rows.append(['LKTBF',v(f'J{r}'),*[n(v(f'{c}{r}'),0) for c in 'KLMNOPQ']])
w('ktbf_inv',['상품','투자자','순매수','누적순매수','5d','10d','20d','6M_Max','6M_Min'],rows)
# otc
for name,cols in [('otc_daily','DEFGHIJ'),('otc_weekly','KLMNOPQ')]:
    rows=[];inv=None
    for r in range(46,71):
        if v(f'B{r}'): inv=v(f'B{r}')
        rows.append([inv,v(f'C{r}'),*[n(v(f'{c}{r}'),1) for c in cols]])
    w(name,['투자자','종류','1Y이하','2Y이하','3Y이하','5Y이하','10Y이하','10Y초과','전체'],rows)
# foreign snapshot
w('fx_snap',['일자','잔고'],[[d(v(f'B{r}')),n(v(f'C{r}'),2)] for r in range(75,89) if v(f'B{r}')])
# lending
rows=[]
for r in range(76,105):
    nm=v(f'J{r}')
    if nm is None: continue
    if isinstance(nm,dt.datetime): nm=f"{nm.year%100}.{nm.month}.{nm.day}통"
    rows.append([nm,*[n(v(f'{c}{r}'),2) for c in 'KLM'],n(v(f'N{r}'),5),*[n(v(f'{c}{r}'),2) for c in 'OPQ']])
w('lending',['종목','거래','상환','잔량','상장잔액대비','전일비','전주비','전월비'],rows)
# rates & futures
rates=[];fut=[]
for basis,rr,fr in [('기본',92,(95,96)),('내부',106,(108,109))]:
    rates.append([basis,n(v(f'C{rr}'),0),n(v(f'E{rr}'),6),n(v(f'G{rr}'),6),n(v(f'I{rr}'),6)])
    for r in fr:
        fut.append([basis,v(f'B{r}'),n(v(f'C{r}'),3),n(v(f'D{r}'),6),n(v(f'E{r}'),4),n(v(f'F{r}'),3),n(v(f'G{r}'),2),n(v(f'H{r}'),3),n(v(f'I{r}'),2)])
w('rates',['기준','잔존일','Call','CD91d','MSB1Y'],rates)
w('fut',['기준','구분','시장가','Implied','PVBP','현물가','현물Basis','이론가','이론Basis'],fut)
rows=[];g=None
for r in range(99,104):
    if v(f'B{r}'): g=v(f'B{r}').replace('\n',' ')
    rows.append([g,v(f'C{r}'),n(v(f'D{r}'),6),n(v(f'E{r}'),6),n(v(f'F{r}'),2),n(v(f'G{r}'),4),n(v(f'H{r}'),5),n(v(f'I{r}'),5)])
w('basket',['구분','종목','Spot','Forward','F_S','PVBP','대차비율','외국인비율'],rows)
# time series
ws2=wb['국채선물누적'];rows=[]
for r in ws2.iter_rows(min_row=4,values_only=True):
    if r[0] is None: break
    rows.append([d(r[0]),r[1],n(r[15],0),n(r[16],0),r[8],n(r[17],0),n(r[18],0)])
rows.reverse()
w('ktbf_cum',['일자','3선_누적','3선_20년AVG','3선_23년AVG','10선_누적','10선_20년AVG','10선_23년AVG'],rows)
ws3=wb['외국인원화채'];rows=[]
for r in ws3.iter_rows(min_row=4,max_col=3,values_only=True):
    if r[0] is None: break
    rows.append([d(r[0]),n(r[1]/1e8,2),n(r[2],3)])
rows.reverse(); w('fx_bond',['일자','잔고','듀레이션'],rows)
ws4=wb['여수신동향'];rows=[]
for r in ws4.iter_rows(min_row=4,min_col=13,max_col=14,values_only=True):
    if r[0] is None: break
    rows.append([d(r[0]),n(r[1]/1e4,2)])
rows.reverse(); w('mmf',['일자','MMF'],rows)
