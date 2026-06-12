(function(){
  'use strict';

  const d3 = window.d3;

  /* ── Debounce ── */
  function debounce(fn, ms) {
    let timer;
    return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  /* ── 1. PERSPECTIVE SWITCHING ── */
  const body = document.body;
  const chips = document.querySelectorAll('.perspective-group .chip');
  const panels = document.querySelectorAll('[data-perspective-content]');

  function showPerspective(p) {
    body.dataset.perspective = p;
    chips.forEach(c => {
      const match = c.dataset.perspective === p;
      c.classList.toggle('active', match);
      c.setAttribute('aria-selected', match ? 'true' : 'false');
    });
    // Show/hide perspective panels — hidden by default via display:none
    panels.forEach(panel => {
      const shouldShow = panel.dataset.perspectiveContent === p;
      panel.classList.toggle('visible', shouldShow);
    });
  }

  if (chips.length) {
    const group = chips[0].closest('.perspective-group');
    group.addEventListener('click', e => {
      const chip = e.target.closest('[data-perspective]');
      if (!chip) return;
      showPerspective(chip.dataset.perspective);
    });
  }

  showPerspective('bull');

  /* ── 2. SCROLLYTELLING ── */
  let activeStep = -1;
  const stepCards = document.querySelectorAll('.step-card');
  const chartTriggers = new Map();

  function registerChartTrigger(step, fn) {
    chartTriggers.set(step, fn);
  }

  if (stepCards.length) {
    let ticking = false;
    const stepObs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const step = parseInt(entry.target.dataset.step, 10);
          entry.target.classList.add('is-active');
          if (step !== activeStep) {
            activeStep = step;
            const fn = chartTriggers.get(step);
            if (fn) fn(step);
          }
        } else {
          entry.target.classList.remove('is-active');
        }
      });
    }, { threshold: 0.5 });
    stepCards.forEach(c => stepObs.observe(c));
  }

  document.addEventListener('DOMContentLoaded', () => {
    const cd = window.__COMPANY_DATA;
    if (!cd) return;

    const isArr = v => Array.isArray(v);

    /* ── 3. REVENUE SCROLLY CHART ── */
    const revContainer = document.getElementById('revenue-chart');
    if (revContainer && isArr(cd.revenue) && cd.revenue.length) {
      const revData = cd.revenue.map(d => ({ year: d.year, val: d.value }));
      const margin = { top: 20, right: 20, bottom: 40, left: 60 };
      function drawRev() {
        const w = revContainer.clientWidth;
        const h = 400;
        revContainer.innerHTML = '';
        const svg = d3.select(revContainer).append('svg').attr('width', w).attr('height', h);
        const iw = w - margin.left - margin.right;
        const ih = h - margin.top - margin.bottom;
        const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

        const x = d3.scalePoint().domain(revData.map(d => d.year)).range([0, iw]);
        const y = d3.scaleLinear().domain([0, d3.max(revData, d => d.val) * 1.12]).range([ih, 0]);

        const area = d3.area().x(d => x(d.year)).y0(ih).y1(d => y(d.val)).curve(d3.curveMonotoneX);
        const line = d3.line().x(d => x(d.year)).y(d => y(d.val)).curve(d3.curveMonotoneX);

        // Gradient
        const defs = svg.append('defs');
        const grad = defs.append('linearGradient').attr('id', 'rev-grad')
          .attr('x1','0').attr('x2','0').attr('y1','0').attr('y2','1');
        grad.append('stop').attr('offset','0%')
          .attr('stop-color', 'var(--bull,#d4a34d)').attr('stop-opacity', 0.25);
        grad.append('stop').attr('offset','100%')
          .attr('stop-color', 'var(--bull,#d4a34d)').attr('stop-opacity', 0.02);

        const areaPath = g.append('path').attr('fill','url(#rev-grad)').attr('opacity', 0.8);
        const linePath = g.append('path').attr('fill','none')
          .attr('stroke', 'var(--bull,#d4a34d)').attr('stroke-width', 2.5);
        const dots = g.selectAll('.dot').data(revData).enter()
          .append('circle').attr('class','dot')
          .attr('r', 5).attr('fill', 'var(--bull,#d4a34d)')
          .attr('stroke', 'var(--bg,#12110f)').attr('stroke-width', 2);

        // Clip
        const clipId = 'rev-clip-' + Date.now();
        defs.append('clipPath').attr('id', clipId)
          .append('rect').attr('x', 0).attr('y', 0).attr('width', 0).attr('height', h);

        areaPath.attr('clip-path', `url(#${clipId})`).attr('d', area(revData));
        linePath.attr('clip-path', `url(#${clipId})`).attr('d', line(revData));
        dots.attr('clip-path', `url(#${clipId})`);

        // Axes
        g.append('g').attr('transform', `translate(0,${ih})`)
          .call(d3.axisBottom(x).tickSize(0).tickPadding(8))
          .style('color', 'var(--text3,#6b655b)').style('font-size', '13px');
        g.append('g').call(d3.axisLeft(y).ticks(5)
          .tickFormat(d => '₹' + (d/1000).toFixed(0) + 'k Cr').tickSize(0).tickPadding(8))
          .style('color', 'var(--text3,#6b655b)').style('font-size', '12px');

        // Horizontal grid lines
        g.selectAll('.grid-line').data(y.ticks(5)).enter()
          .append('line').attr('class','grid-line')
          .attr('x1', 0).attr('x2', iw).attr('y1', d => y(d)).attr('y2', d => y(d))
          .attr('stroke', 'var(--border,#3a3630)').attr('stroke-dasharray','3,3').attr('opacity', 0.5);

        // Tooltip
        const tooltip = d3.select(revContainer).append('div').attr('class','d3-tooltip').style('display','none');
        dots.on('mouseenter', function(e, d) {
          d3.select(this).attr('r', 7);
          tooltip.style('display','block')
            .html(`<strong>${d.year}</strong>: ₹${(d.val/1000).toFixed(1)}k Cr`)
            .style('left', (x(d.year) + margin.left + 12) + 'px')
            .style('top', (y(d.val) - 10) + 'px');
        }).on('mouseleave', function() {
          d3.select(this).attr('r', 5);
          tooltip.style('display','none');
        });

        // Scrolly — clip rect expands/shrinks as user scrolls in either direction
        function animateRev(s) {
          const lastIdx = s; // steps are 0-4, each is one data point
          let endX = x(revData[lastIdx].year) + margin.left + 8;
          // ensure at least the first point width
          if (s === 0) endX = x(revData[0].year) + margin.left + 8;
          svg.select(`#${clipId} rect`).interrupt()
            .transition().duration(400).ease(d3.easeCubicOut)
            .attr('width', Math.min(endX, w));
        }

        [0,1,2,3,4].forEach(i => registerChartTrigger(i, () => animateRev(i)));
      }
      drawRev();
      window.addEventListener('resize', debounce(drawRev, 200));
    }

    /* ── 4. PROFIT CHART ── */
    const profitContainer = document.getElementById('profit-chart');
    if (profitContainer && isArr(cd.profit) && cd.profit.length) {
      const pData = cd.profit.map(d => ({ year: d.year, val: d.value }));
      const mData = cd.patMargin.map(d => ({ year: d.year, val: d.value }));

      function drawProfit() {
        const w = profitContainer.clientWidth;
        const h = 350;
        profitContainer.innerHTML = '';
        const svg = d3.select(profitContainer).append('svg').attr('width', w).attr('height', h);
        const m = { top: 25, right: 65, bottom: 35, left: 60 };
        const iw = w - m.left - m.right;
        const ih = h - m.top - m.bottom;
        const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);

        const x0 = d3.scaleBand().domain(pData.map(d => d.year)).range([0, iw]).padding(0.3);

        // Left axis: revenue bars in ₹ Cr
        const yL = d3.scaleLinear().domain([0, d3.max(pData, d => d.val) * 1.15]).range([ih, 0]);
        // Right axis: PAT margin %
        const yR = d3.scaleLinear().domain([0, d3.max(mData, d => d.val) * 1.15]).range([ih, 0]);

        g.selectAll('.bar').data(pData).enter()
          .append('rect').attr('class','bar')
          .attr('x', d => x0(d.year)).attr('width', x0.bandwidth())
          .attr('y', ih).attr('height', 0)
          .attr('fill', 'var(--bull,#d4a34d)').attr('opacity', 0.7)
          .transition().duration(800).delay((d,i) => i*120)
          .attr('y', d => yL(d.val)).attr('height', d => ih - yL(d.val));

        // Margin line
        const line = d3.line()
          .x(d => x0(d.year) + x0.bandwidth()/2).y(d => yR(d.val))
          .curve(d3.curveMonotoneX);
        g.append('path').datum(mData)
          .attr('fill','none').attr('stroke', 'var(--neutral,#6b95c0)').attr('stroke-width', 2.5)
          .attr('d', line);
        g.selectAll('.margin-dot').data(mData).enter()
          .append('circle')
          .attr('cx', d => x0(d.year) + x0.bandwidth()/2).attr('cy', d => yR(d.val))
          .attr('r', 4).attr('fill', 'var(--neutral,#6b95c0)');

        // Right axis label + axis
        g.append('text').attr('x', iw + 40).attr('y', 8)
          .attr('fill', 'var(--neutral,#6b95c0)').style('font-size','11px').style('font-family','Inter,sans-serif')
          .text('PAT Margin %');
        g.append('g').attr('transform', `translate(${iw},0)`)
          .call(d3.axisRight(yR).ticks(5).tickFormat(d => d + '%').tickSize(0).tickPadding(6))
          .style('color', 'var(--neutral,#6b95c0)').style('font-size','11px');

        // Grid lines
        g.selectAll('.grid-line').data(yL.ticks(5)).enter()
          .append('line').attr('class','grid-line')
          .attr('x1', 0).attr('x2', iw).attr('y1', d => yL(d)).attr('y2', d => yL(d))
          .attr('stroke', 'var(--border)').attr('stroke-dasharray','3,3').attr('opacity', 0.4);

        // Left axis
        g.append('g').call(d3.axisLeft(yL).ticks(5)
          .tickFormat(d => '₹' + (d/1000).toFixed(0) + 'k Cr').tickSize(0).tickPadding(6))
          .style('color', 'var(--text3,#6b655b)').style('font-size','12px');
        // Bottom axis
        g.append('g').attr('transform', `translate(0,${ih})`)
          .call(d3.axisBottom(x0).tickSize(0).tickPadding(6))
          .style('color', 'var(--text3,#6b655b)').style('font-size','13px');
      }
      drawProfit();
      window.addEventListener('resize', debounce(drawProfit, 200));
    }

    /* ── 5. RATIOS CHART ── */
    const ratiosContainer = document.getElementById('ratios-chart');
    if (ratiosContainer && isArr(cd.debtEquity) && cd.debtEquity.length) {
      const deData = cd.debtEquity.map(d => ({
        year: d.year,
        de: d.value,
        roe: (cd.roe || []).find(r => r.year === d.year)?.value || 0
      }));

      function drawRatios() {
        const w = ratiosContainer.clientWidth;
        const h = 300;
        ratiosContainer.innerHTML = '';
        const svg = d3.select(ratiosContainer).append('svg').attr('width', w).attr('height', h);
        const m = { top: 20, right: 60, bottom: 35, left: 55 };
        const iw = w - m.left - m.right;
        const ih = h - m.top - m.bottom;
        const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);

        const x = d3.scaleBand().domain(deData.map(d => d.year)).range([0, iw]).padding(0.3);

        // Left axis: ROE %
        const yL = d3.scaleLinear().domain([0, 55]).range([ih, 0]);
        // Right axis: D/E ratio
        const yR = d3.scaleLinear().domain([0, 0.10]).range([ih, 0]);

        g.selectAll('.bar-roe').data(deData).enter()
          .append('rect').attr('class','bar-roe')
          .attr('x', d => x(d.year)).attr('width', x.bandwidth())
          .attr('y', d => yL(d.roe)).attr('height', d => ih - yL(d.roe))
          .attr('fill', 'var(--bull,#d4a34d)').attr('opacity', 0.6);

        const deLine = d3.line()
          .x(d => x(d.year) + x.bandwidth()/2).y(d => yR(d.de))
          .curve(d3.curveMonotoneX);
        g.append('path').datum(deData)
          .attr('fill','none').attr('stroke', 'var(--bear,#c0443b)').attr('stroke-width', 2)
          .attr('d', deLine);
        g.selectAll('.de-dot').data(deData).enter()
          .append('circle')
          .attr('cx', d => x(d.year) + x.bandwidth()/2).attr('cy', d => yR(d.de))
          .attr('r', 3).attr('fill', 'var(--bear,#c0443b)');

        // Right axis
        g.append('g').attr('transform', `translate(${iw},0)`)
          .call(d3.axisRight(yR).ticks(4).tickFormat(d3.format('.2f')).tickSize(0).tickPadding(6))
          .style('color', 'var(--bear,#c0443b)').style('font-size','11px');
        g.append('text').attr('x', iw + 42).attr('y', 8)
          .attr('fill', 'var(--bear,#c0443b)').style('font-size','11px').style('font-family','Inter,sans-serif')
          .text('D/E Ratio');

        // Left axis
        g.append('g').call(d3.axisLeft(yL).ticks(5).tickFormat(d => d + '%').tickSize(0).tickPadding(6))
          .style('color', 'var(--text3,#6b655b)').style('font-size','12px');
        // Bottom axis
        g.append('g').attr('transform', `translate(0,${ih})`)
          .call(d3.axisBottom(x).tickSize(0).tickPadding(6))
          .style('color', 'var(--text3,#6b655b)').style('font-size','13px');

        // Grid lines
        g.selectAll('.grid-line').data(yL.ticks(5)).enter()
          .append('line').attr('class','grid-line')
          .attr('x1', 0).attr('x2', iw).attr('y1', d => yL(d)).attr('y2', d => yL(d))
          .attr('stroke', 'var(--border)').attr('stroke-dasharray','3,3').attr('opacity', 0.4);

        // Label
        g.append('text').attr('x', 4).attr('y', -4)
          .attr('fill', 'var(--text3,#6b655b)').style('font-size','11px').style('font-family','Inter,sans-serif')
          .text('ROE %');
      }
      drawRatios();
      window.addEventListener('resize', debounce(drawRatios, 200));
    }

    /* ── 6. OWNERSHIP DONUT ── */
    const ownContainer = document.getElementById('ownership-chart');
    if (ownContainer) {
      const ownData = [
        { label: 'Tata Sons', val: 72.4, color: '#d4a34d' },
        { label: 'FII', val: 13.2, color: '#6b95c0' },
        { label: 'MF / Insurance', val: 6.8, color: '#68a88a' },
        { label: 'Retail', val: 3.5, color: '#a08b6f' },
        { label: 'Others', val: 4.1, color: '#8a7a6a' },
      ];
      function drawOwn() {
        const w = ownContainer.clientWidth;
        const h = 300;
        ownContainer.innerHTML = '';
        const svg = d3.select(ownContainer).append('svg').attr('width', w).attr('height', h);
        const radius = Math.min(w, h) / 2.5;
        const g = svg.append('g').attr('transform', `translate(${w/2},${h/2})`);

        const pie = d3.pie().value(d => d.val).sort(null);
        const arc = d3.arc().innerRadius(radius*0.5).outerRadius(radius);
        const arcHover = d3.arc().innerRadius(radius*0.5).outerRadius(radius + 8);

        g.selectAll('.arc').data(pie(ownData)).enter()
          .append('path').attr('class','arc')
          .attr('d', arc).attr('fill', d => d.data.color)
          .attr('stroke', 'var(--bg,#12110f)').attr('stroke-width', 2)
          .attr('opacity', 0).transition().duration(600).delay((d,i) => i*100)
          .attr('opacity', 1);

        // Legend
        const legend = g.selectAll('.legend').data(ownData).enter()
          .append('g').attr('class','legend')
          .attr('transform', (d,i) => `translate(${radius + 30},${-radius + i*25})`);
        legend.append('rect').attr('width',12).attr('height',12).attr('rx',2)
          .attr('fill', d => d.color).attr('opacity', 0.9);
        legend.append('text').attr('x',18).attr('y',11)
          .attr('fill', 'var(--text2,#a8a096)').style('font-size','12px')
          .text(d => `${d.label}: ${d.val}%`);

        // Center text
        g.append('text').attr('text-anchor','middle').attr('y',-6)
          .attr('fill', 'var(--text,#e8e2d8)').style('font-size','22px').style('font-weight','700')
          .style('font-family','Inter,sans-serif').attr('fill', 'var(--text)')
          .text('72.4%');
        g.append('text').attr('text-anchor','middle').attr('y',12)
          .attr('fill', 'var(--text2,#a8a096)').style('font-size','11px')
          .text('Promoter');
      }
      drawOwn();
      window.addEventListener('resize', debounce(drawOwn, 200));
    }

    /* ── 7. TIMELINE FADE-IN ── */
    const timelineItems = document.querySelectorAll('.timeline-item');
    if (timelineItems.length) {
      const tlObs = new IntersectionObserver(entries => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            e.target.classList.add('visible');
            tlObs.unobserve(e.target);
          }
        });
      }, { threshold: 0.25 });
      timelineItems.forEach(item => tlObs.observe(item));
    }

    /* ── 8. CONNECTION FORCE GRAPH ── */
    const graphContainer = document.getElementById('connection-graph');
    const overlay = document.getElementById('graph-overlay');
    const toggleBtn = document.getElementById('graph-toggle-btn');
    const closeBtn = document.getElementById('graph-close');

    if (graphContainer && overlay && toggleBtn && closeBtn) {
      const graphData = {
        nodes: [
          { id: 'TCS', group: 'self', radius: 26 },
          { id: 'Tata Sons', group: 'promoter', radius: 18 },
          { id: 'Tata Motors', group: 'group', radius: 13 },
          { id: 'Tata Steel', group: 'group', radius: 13 },
          { id: 'Tata Power', group: 'group', radius: 13 },
          { id: 'Tata Comm', group: 'group', radius: 11 },
          { id: 'Tata Elxsi', group: 'group', radius: 11 },
          { id: 'Infosys', group: 'competitor', radius: 13 },
          { id: 'Wipro', group: 'competitor', radius: 13 },
          { id: 'HCL Tech', group: 'competitor', radius: 13 },
          { id: 'Tech M', group: 'competitor', radius: 11 },
          { id: 'BSE', group: 'exchange', radius: 11 },
          { id: 'NSE', group: 'exchange', radius: 11 },
        ],
        links: [
          { source: 'TCS', target: 'Tata Sons' },
          { source: 'TCS', target: 'Tata Motors' },
          { source: 'TCS', target: 'Tata Steel' },
          { source: 'TCS', target: 'Tata Power' },
          { source: 'TCS', target: 'Tata Comm' },
          { source: 'TCS', target: 'Tata Elxsi' },
          { source: 'TCS', target: 'Infosys' },
          { source: 'TCS', target: 'Wipro' },
          { source: 'TCS', target: 'HCL Tech' },
          { source: 'TCS', target: 'Tech M' },
          { source: 'TCS', target: 'BSE' },
          { source: 'TCS', target: 'NSE' },
          { source: 'Tata Sons', target: 'Tata Motors' },
          { source: 'Tata Sons', target: 'Tata Steel' },
          { source: 'Tata Sons', target: 'Tata Power' },
        ]
      };

      const groupColors = {
        self: '#d4a34d',
        promoter: '#c0443b',
        group: '#6b95c0',
        competitor: '#68a88a',
        exchange: '#a08b6f'
      };

      function drawGraph() {
        const rect = graphContainer.getBoundingClientRect();
        const w = Math.max(rect.width, 400);
        const h = Math.min(600, Math.max(400, w * 0.55));
        graphContainer.innerHTML = '';
        const svg = d3.select(graphContainer).append('svg')
          .attr('width', w).attr('height', h).attr('viewBox', `0 0 ${w} ${h}`);

        const sim = d3.forceSimulation(graphData.nodes)
          .force('link', d3.forceLink(graphData.links).id(d => d.id).distance(90))
          .force('charge', d3.forceManyBody().strength(-300))
          .force('center', d3.forceCenter(w/2, h/2))
          .force('collide', d3.forceCollide(d => d.radius + 8));

        const link = svg.selectAll('.link').data(graphData.links).enter()
          .append('line').attr('class','link')
          .attr('stroke', 'var(--border,#3a3630)').attr('stroke-width', 1.5)
          .attr('stroke-opacity', 0.5);

        const node = svg.selectAll('.node').data(graphData.nodes).enter()
          .append('circle').attr('class','node')
          .attr('r', d => d.radius)
          .attr('fill', d => groupColors[d.group] || '#666')
          .attr('stroke', 'var(--bg,#12110f)').attr('stroke-width', 2)
          .attr('cursor', 'pointer');

        const label = svg.selectAll('.nodelabel').data(graphData.nodes).enter()
          .append('text').attr('class','nodelabel')
          .text(d => d.id).attr('text-anchor','middle')
          .attr('fill', 'var(--text,#e8e2d8)').style('font-size', '11px')
          .style('font-family','Inter,sans-serif').style('pointer-events','none');

        // Legend
        const legendData = [
          { label: 'Self', color: groupColors.self },
          { label: 'Promoter', color: groupColors.promoter },
          { label: 'Tata Group', color: groupColors.group },
          { label: 'Competitor', color: groupColors.competitor },
          { label: 'Exchange', color: groupColors.exchange },
        ];
        const lg = svg.append('g').attr('transform', `translate(12, ${h - 90})`);
        legendData.forEach((item, i) => {
          const row = lg.append('g').attr('transform', `translate(0, ${i * 18})`);
          row.append('circle').attr('r', 5).attr('fill', item.color);
          row.append('text').attr('x', 12).attr('y', 4)
            .attr('fill', 'var(--text2,#a8a096)').style('font-size','11px')
            .style('font-family','Inter,sans-serif').text(item.label);
        });

        sim.on('tick', () => {
          link.attr('x1', d => d.source.x).attr('y1', d => d.source.y)
              .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
          node.attr('cx', d => d.x).attr('cy', d => d.y);
          label.attr('x', d => d.x).attr('y', d => d.y + d.radius + 14);
        });

        return () => sim.stop();
      }

      let cleanupGraph;
      toggleBtn.addEventListener('click', () => {
        overlay.classList.add('open');
        requestAnimationFrame(() => {
          if (graphContainer.innerHTML === '') cleanupGraph = drawGraph();
        });
      });
      closeBtn.addEventListener('click', () => {
        overlay.classList.remove('open');
      });
      overlay.addEventListener('click', e => {
        if (e.target === overlay) overlay.classList.remove('open');
      });
    }

    /* ── 9. CARD FADE-IN ON SCROLL ── */
    const fadeCards = document.querySelectorAll('.data-card');
    if (fadeCards.length) {
      const fadeObs = new IntersectionObserver(entries => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            e.target.classList.add('visible');
            fadeObs.unobserve(e.target);
          }
        });
      }, { threshold: 0.25 });
      fadeCards.forEach(c => fadeObs.observe(c));
    }
  });
})();
