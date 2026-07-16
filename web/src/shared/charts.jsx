// Componentes de visualización d3 compartidos entre pantallas (publish,
// listings, fairvalue, home). Antes estaban duplicados como copias locales en
// cada feature (#25), lo que generaba drift entre versiones y trababa el
// code-split limpio. Esta es la fuente única canónica.
import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Card } from './ui/components.jsx';

export const CounterfactualTornadoD3 = ({ items }) => {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !Array.isArray(items) || !items.length) return;
    const draw = () => {
      d3.select(el).selectAll('*').remove();
      const rows = items.slice(0, 8);
      const W = el.clientWidth || 480, rowH = 34, m = { l: 148, r: 64, t: 6, b: 6 };
      const H = rows.length * rowH + m.t + m.b;
      const maxAbs = Math.max(1, d3.max(rows, d => Math.abs(d.delta_pct)));
      const halfW = (W - m.l - m.r) / 2;
      const cx = m.l + halfW;
      const x = d3.scaleLinear().domain([0, maxAbs]).range([0, halfW]);
      const svg = d3.select(el).append('svg').attr('width', W).attr('height', H);
      svg.append('line').attr('x1', cx).attr('x2', cx).attr('y1', m.t).attr('y2', H - m.b)
        .attr('stroke', 'var(--line)').attr('stroke-width', 1);
      const g = svg.selectAll('g').data(rows).enter().append('g')
        .attr('transform', (d, i) => `translate(0,${m.t + i * rowH + rowH / 2})`);
      g.append('text').attr('x', m.l - 12).attr('dy', '.32em').attr('text-anchor', 'end')
        .attr('class', 'd3-cat').text(d => d.label);
      g.append('rect').attr('y', -9).attr('height', 18).attr('rx', 5)
        .attr('x', d => d.direction === 'baja' ? cx - x(Math.abs(d.delta_pct)) : cx)
        .attr('fill', d => d.direction === 'sube' ? '#16a34a' : d.direction === 'baja' ? '#dc2626' : '#94a3b8')
        .attr('width', 0).transition().duration(600).delay((d, i) => i * 45)
        .attr('width', d => Math.max(2, x(Math.abs(d.delta_pct))));
      g.append('text').attr('dy', '.32em').attr('class', 'd3-val')
        .attr('x', d => d.direction === 'baja' ? cx - x(Math.abs(d.delta_pct)) - 8 : cx + x(Math.abs(d.delta_pct)) + 8)
        .attr('text-anchor', d => d.direction === 'baja' ? 'end' : 'start')
        .attr('fill', d => d.direction === 'sube' ? '#15803d' : d.direction === 'baja' ? '#b91c1c' : '#64748b')
        .text(d => (d.direction === 'sube' ? '+' : d.direction === 'baja' ? '−' : '') + '$' + Math.abs(Math.round(d.delta)).toLocaleString('en-US'));
    };
    draw();
    let ro;
    if (window.ResizeObserver) { ro = new ResizeObserver(draw); ro.observe(el); }
    return () => { if (ro) ro.disconnect(); };
  }, [items]);
  return <div ref={ref} className="d3-cf" style={{ width: '100%' }}/>;
};

export const CounterfactualPanel = ({ cf, loading, error, isSeller }) => {
  if (loading) {
    return (
      <Card>
        <div className="section-h">{isSeller ? 'Cómo subir tu precio sugerido' : 'Qué explica este precio'}</div>
        <p className="tiny muted" style={{ marginTop: 8 }}>Calculando palancas con el modelo…</p>
      </Card>
    );
  }
  if (error || !cf || !cf.items || cf.items.length === 0) {
    if (error) {
      return (
        <Card>
          <div className="section-h">{isSeller ? 'Cómo subir tu precio sugerido' : 'Qué explica este precio'}</div>
          <p className="tiny muted" style={{ marginTop: 8 }}>No se pudieron calcular las palancas de precio.</p>
        </Card>
      );
    }
    return null;
  }

  const items = isSeller
    ? cf.items.filter(i => i.kind !== 'informativo' && i.direction === 'sube')
    : cf.items;
  if (items.length === 0) return null;
  const title = isSeller ? 'Cómo subir tu precio sugerido' : 'Qué explica este precio';
  const sub = isSeller
    ? 'Cambios accionables ordenados por impacto en la referencia del modelo.'
    : 'Cuánto aporta o resta cada característica, según el modelo.';
  return (
    <Card>
      <div className="section-h">{title}</div>
      <p className="tiny muted" style={{ marginTop: -4, marginBottom: 8 }}>{sub}</p>
      <CounterfactualTornadoD3 items={items}/>
      <p className="tiny muted" style={{ marginTop: 10 }}>
        Estimaciones del modelo Wasi: reflejan <strong>correlaciones del mercado limeño</strong>, no
        causalidad. Algún efecto puede ser contraintuitivo (p. ej. baños en zonas donde
        los avisos con más baños son más antiguos); es una limitación conocida del enfoque.
      </p>
    </Card>
  );
};

export const PoiImportanceD3 = ({ data }) => {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !Array.isArray(data) || !data.length) return;
    const draw = () => {
      d3.select(el).selectAll('*').remove();
      const rows = data.slice(0, 10);
      const W = el.clientWidth || 480, rowH = 30, m = { l: 132, r: 52, t: 8, b: 8 };
      const H = rows.length * rowH + m.t + m.b;
      const x = d3.scaleLinear().domain([0, d3.max(rows, d => d.pct) || 1]).range([m.l, W - m.r]);
      const color = d3.scaleSequential().domain([rows.length - 1, 0]).interpolator(d3.interpolateRgb('#9ec5fe', '#1d4ed8'));
      const svg = d3.select(el).append('svg').attr('width', W).attr('height', H);
      const g = svg.selectAll('g').data(rows).enter().append('g')
        .attr('transform', (d, i) => `translate(0,${m.t + i * rowH + rowH / 2})`);
      g.append('text').attr('x', m.l - 10).attr('dy', '.32em').attr('text-anchor', 'end')
        .attr('class', 'd3-cat').text(d => d.category);
      g.append('line').attr('x1', m.l).attr('y1', 0).attr('y2', 0)
        .attr('stroke', (d, i) => color(i)).attr('stroke-width', 3).attr('stroke-linecap', 'round')
        .attr('x2', m.l).transition().duration(650).delay((d, i) => i * 45).attr('x2', d => x(d.pct));
      g.append('circle').attr('cx', m.l).attr('cy', 0).attr('r', 5).attr('fill', (d, i) => color(i))
        .transition().duration(700).delay((d, i) => i * 45).attr('cx', d => x(d.pct));
      g.append('text').attr('x', d => x(d.pct) + 10).attr('dy', '.32em')
        .attr('class', 'd3-val')
        .text(d => d.pct_of_env_total != null
          ? `${d.pct_of_env_total.toFixed(0)}% (${d.pct.toFixed(2)})`
          : d.pct.toFixed(2) + '%');
    };
    draw();
    let ro;
    if (window.ResizeObserver) { ro = new ResizeObserver(draw); ro.observe(el); }
    return () => { if (ro) ro.disconnect(); };
  }, [data]);
  return <div ref={ref} className="d3-poi" style={{ width: '100%' }}/>;
};
