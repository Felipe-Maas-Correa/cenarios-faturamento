import { analyse } from "@/lib/calc";
import { PCT, R } from "@/lib/format";
import { motivosMelhor, ranking } from "@/lib/report";
import type { Projeto } from "@/lib/types";
import { CountUp } from "./CountUp";
import { Icon } from "./ui";

const dias = (n: number) => (n < 0.5 ? "à vista" : `${Math.round(n)} dias`);

/** Análise das propostas: recomendação, ranking por custo efetivo e comparação de preço, prazo e pendências. */
export function Analise({ P, onEditar }: { P: Projeto; onEditar: (a: "cenarios" | "impostos") => void }) {
  const A = analyse(P);
  const linhas = ranking(P);
  const rec = A.recomendada;
  const motivos = motivosMelhor(P);
  const taxa = (A.taxa * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 });

  if (!A.comparavel || !rec) {
    return (
      <section className="section">
        <h2 data-anim="rise">Análise das propostas</h2>
        <div className="empty" data-anim="panel">
          <h3>Cadastre pelo menos duas propostas com valor</h3>
          <p className="hint">
            A ferramenta compara preço, condição de pagamento, DIFAL e crédito de cada cenário e indica qual proposta
            vale mais a pena. Abra <b>Editar projeto → Cenários</b> e preencha os valores.
          </p>
          <button className="btn" onClick={() => onEditar("cenarios")}>
            <Icon name="edit" size={16} /> Preencher cenários
          </button>
        </div>
      </section>
    );
  }

  const limpa = rec.pendencias.length === 0;
  return (
    <section className="section">
      <h2 data-anim="rise">Análise das propostas</h2>

      <div className={`verdict${limpa ? "" : " com-pend"}`} data-anim="panel">
        <div className="vd-main">
          <div className="eyebrow vd-eye">
            <Icon name={limpa ? "check" : "warn"} size={15} /> {limpa ? "Proposta recomendada" : "Melhor custo, com pendências"}
          </div>
          <h3 className="vd-name">{rec.sc.nome}</h3>
          <div className="vd-facts">
            <span>
              <small>Prazo médio</small>
              <b>{dias(rec.prazoMedio)}</b>
            </span>
            <span>
              <small>Valor líquido</small>
              <b>{R(rec.liq)}</b>
            </span>
            <span>
              <small>Modalidade</small>
              <b>{rec.sc.modal === "direto" ? "Direto ao cliente" : "Via Alpha Filial"}</b>
            </span>
            {rec.difalStatus && (
              <span>
                <small>DIFAL</small>
                <b>{rec.difalStatus === "pendente" ? "Não definido" : rec.difalStatus === "cliente" ? "Do cliente" : R(rec.difal)}</b>
              </span>
            )}
          </div>
        </div>
        <div className="vd-cost">
          <small>Custo efetivo</small>
          <CountUp className="vd-big" value={rec.vp} />
          <small>valor presente a {taxa}% ao mês</small>
        </div>
        <ul className="vd-list">
          {motivos.map((m, k) => (
            <li key={k} className={m.ressalva ? "res" : ""}>
              <Icon name={m.ressalva ? "warn" : "check"} size={16} className="vi" />
              <span>{m.texto}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="tbl-wrap" data-anim="rise">
        <table className="rank">
          <thead>
            <tr>
              <th>#</th>
              <th>Proposta</th>
              <th>Valor líquido</th>
              <th>DIFAL</th>
              <th>Prazo médio</th>
              <th>Custo efetivo</th>
              <th>Diferença para a melhor</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.nome + l.pos} className={l.r === rec ? "best-row" : ""}>
                <td className="num">{l.pos}</td>
                <td>
                  <div className="rk-name">{l.nome}</div>
                  <div className="rk-tags">
                    {l.selos.map((s) => (
                      <span key={s} className={`tag ${s === "Recomendada" ? "good" : "acc"}`}>
                        {s}
                      </span>
                    ))}
                    {l.r.pendencias.map((p) => (
                      <span key={p} className={`tag ${p.startsWith("DIFAL") ? "bad" : "warn"}`}>
                        {p}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="num">{R(l.r.liq)}</td>
                <td className={`num${l.r.difalStatus === "pendente" ? " warn-t" : ""}`}>{l.difalTxt}</td>
                <td className="num">{dias(l.r.prazoMedio)}</td>
                <td className="num">
                  <b>{R(l.r.vp)}</b>
                </td>
                <td className="rk-dif">
                  {l.dif < 0.005 ? (
                    <span className="good-t">
                      <b>Menor custo</b>
                    </span>
                  ) : (
                    <>
                      <div className="num">
                        + {R(l.dif)} <small>({PCT(l.difPct * 100)})</small>
                      </div>
                      <div className="bar">
                        <i style={{ width: `${Math.max(6, l.barra * 100)}%` }} />
                      </div>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint">
        <b>Custo efetivo</b> = valor líquido de cada parcela trazido a valor presente a {taxa}% ao mês (custo de capital; se não
        for informado, usa a taxa financeira). Menor é melhor. Propostas com pendências (crédito em análise ou DIFAL não
        definido) ficam fora da recomendação até serem resolvidas.{" "}
        <button className="linkbtn" onClick={() => onEditar("impostos")}>
          Alterar custo de capital
        </button>
      </p>
    </section>
  );
}
