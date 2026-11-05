import re,sys
path=sys.argv[1]
s=open(path).read()
rows=[]
for m in re.finditer(r'^### (C-\d{3}) · (.+?)\n(.*?)(?=^### |^## |\Z)', s, re.S|re.M):
    cid,title,body=m.groups()
    if cid=='C-000': continue
    sev=re.search(r'\*\*Severidade:\*\* ([^\n]+)',body)
    area=re.search(r'\*\*Área / item do plano:\*\* ([^\n·]+)',body)
    st=re.search(r'\*\*Status:\*\* ([^\n]+)',body)
    sevv=sev.group(1).split(' (')[0].strip() if sev else '—'
    rows.append((cid,sevv,(area.group(1).strip() if area else '—'),title.strip(),(st.group(1).strip() if st else '—')))
counts={}
for r in rows: counts[r[1]]=counts.get(r[1],0)+1
order=['Crítica','Alta','Média','Baixa']
table="| ID | Severidade | Item | Título | Status |\n| --- | --- | --- | --- | --- |\n"+"\n".join(f"| {c} | {v} | {a} | {t} | {st} |" for c,v,a,t,st in rows)
summary="**Totais:** " + " · ".join(f"{k}: {counts.get(k,0)}" for k in order) + f" · Outros: {sum(v for k,v in counts.items() if k not in order)}"
urg="\n\n> **Urgente, sem esperar o fim da análise:** C-046 + C-065 + C-047 + C-078 (servidor público com banco/Redis expostos e segredos de desenvolvimento), C-075 (HTTP sem TLS), C-076 (backup de hoje, com a chave do cofre, fora do servidor); depois C-019, C-020, C-021."
s=re.sub(r'## Resumo\n.*?\n\*\*Status possíveis:\*\*', "## Resumo\n\n"+summary+urg+"\n\n"+table+"\n\n**Status possíveis:**", s, count=1, flags=re.S)
open(path,'w').write(s)
print(summary, len(rows))
