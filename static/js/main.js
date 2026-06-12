(function(){
  'use strict';

  /* ── 1. PERSPECTIVE SWITCHING ── */
  const body = document.body;
  const chips = document.querySelectorAll('.perspective-group .chip');
  if (chips.length) {
    const group = chips[0].closest('.perspective-group');
    group.addEventListener('click', e => {
      const chip = e.target.closest('[data-perspective]');
      if (!chip) return;
      const p = chip.dataset.perspective;
      body.dataset.perspective = p;
      chips.forEach(c => {
        c.classList.toggle('active', c === chip);
        c.setAttribute('aria-selected', c === chip);
      });
    });
  }

  /* ── 2. SCROLLYTELLING ── */
  let activeStep = -1;
  const stepCards = document.querySelectorAll('.step-card');
  const chartTriggers = new Map(); // step -> callback

  function registerChartTrigger(step, fn) {
    chartTriggers.set(step, fn);
  }

  if (stepCards.length) {
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
    }, { threshold: 0.6 });
    stepCards.forEach(c => stepObs.observe(c));
  }

  /* ── 3. D3 REVENUE SCROLLY CHART ── */
  document.addEventListener('DOMContentLoaded', () => {
    const cd = window.__COMPANY_DATA;
    if (!cd) return;

    /* Revenue chart */
    const revContainer = document.getElementById('revenue-chart');
    if (revContainer && cd.revenue && cd.revenue.length) {
      const revData = cd.revenue.map(d => ({ year: d.year, val: d.value }));
      const margin = { top: 20, right: 20, bottom: 40, left: 55 };
      const drawRev = () => {
        const w = revContainer.clientWidth;
        const h = 350;
        revContainer.innerHTML = '';
        const svg = d3.select(revContainer).append('svg').attr('width', w).attr('height', h);
        const innerW = w - margin.left - margin.right;
        const innerH = h - margin.top - margin.bottom;
        const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

        const x = d3.scalePoint()
          .domain(revData.map(d => d.year))
          .range([0, innerW]);
        const y = d3.scaleLinear()
          .domain([0, d3.max(revData, d => d.val) * 1.12])
          .range([innerH, 0]);

        const area = d3.area()
          .x(d => x(d.year))
          .y0(innerH)
          .y1(d => y(d.val))
          .curve(d3.curveMonotoneX);
        const line = d3.line()
          .x(d => x(d.year))
          .y(d => y(d.val))
          .curve(d3.curveMonotoneX);

        g.append('defs').append('linearGradient')
          .attr('id', 'rev-grad').attr('x1','0').attr('x2','0').attr('y1','0').attr('y2','1')
          .append('rect').attr('id','grad-rect'); // placeholder
        const grad = svg.select('#rev-grad');
        grad.append('stop').attr('offset','0%').attr('stop-color','var(--bull,#d4a34d)').attr('stop-opacity',0.3);
        grad.append('stop').attr('offset','100%').attr('stop-color','var(--bull,#d4a34d)').attr('stop-opacity',0.02);

        const areaPath = g.append('path').attr('fill','url(#rev-grad)').attr('d', area(revData)).attr('opacity',0.8);
        const linePath = g.append('path').attr('fill','none').attr('stroke','var(--bull,#d4a34d)').attr('stroke-width',2.5).attr('d', line(revData));

        const dots = g.selectAll('.dot').data(revData).enter()
          .append('circle').attr('class','dot')
          .attr('cx', d => x(d.year)).attr('cy', d => y(d.val))
          .attr('r', 5).attr('fill','var(--bull,#d4a34d)').attr('stroke','var(--bg,#12110f)').attr('stroke-width',2);

        // Axes
        const xAxis = d3.axisBottom(x).tickSize(0).tickPadding(8);
        g.append('g').attr('transform', `translate(0,${innerH})`).call(xAxis)
          .style('color','var(--text3,#6b655b)').style('font-size','13px');

        const yAxis = d3.axisLeft(y).ticks(5).tickFormat(d => '₹' + (d/1000).toFixed(0) + 'k Cr').tickSize(0).tickPadding(8);
        g.append('g').call(yAxis)
          .style('color','var(--text3,#6b655b)').style('font-size','12px');

        // Tooltip
        const tooltip = d3.select(revContainer).append('div').attr('class','d3-tooltip').style('display','none');
        dots.on('mouseenter', function(e,d) {
          d3.select(this).attr('r',7);
          tooltip.style('display','block')
            .html(`<strong>${d.year}</strong>: ₹${(d.val/1000).toFixed(1)}k Cr`)
            .style('left',(x(d.year)+margin.left+12)+'px').style('top',(y(d.val)-10)+'px');
        }).on('mouseleave', function() {
          d3.select(this).attr('r',5);
          tooltip.style('display','none');
        });

        // Scrolly reveal: clip area progressively
        const clipId = 'rev-clip';
        svg.append('defs').append('clipPath').attr('id',clipId)
          .append('rect').attr('x',0).attr('y',0).attr('width',0).attr('height',h);
        areaPath.attr('clip-path', `url(#${clipId})`);
        linePath.attr('clip-path', `url(#${clipId})`);
        dots.attr('clip-path', `url(#${clipId})`);

        const steps = [[0],[0,1],[0,1,2],[0,1,2,3],[0,1,2,3,4]];
        registerChartTrigger(0, () => animateRev(0));
        registerChartTrigger(1, () => animateRev(1));
        registerChartTrigger(2, () => animateRev(2));
        registerChartTrigger(3, () => animateRev(3));
        registerChartTrigger(4, () => animateRev(4));

        const maxStepReached = { v: -1 };
        function animateRev(s) {
          if (s <= maxStepReached.v) return;
          maxStepReached.v = s;
          const points = steps[s];
          const lastIdx = points[points.length-1];
          let endX = x(revData[lastIdx].year) + margin.left + 8;
          // If we already have a wider clip, don't shrink
          const curW = parseFloat(svg.select(`#${clipId} rect`).attr('width'));
          if (endX < curW) endX = curW;
          svg.select(`#${clipId} rect`).transition().duration(600).ease(d3.easeCubicOut)
            .attr('width', endX);
        }
      };
      drawRev();
      window.addEventListener('resize', drawRev);
    }

    /* ── 4. PROFIT CHART ── */
    const profitContainer = document.getElementById('profit-chart');
    if (profitContainer && cd.profit && cd.profit.length) {
      const pData = cd.profit.map(d => ({ year: d.year, val: d.value }));
      const mData = cd.pat_ratio.map(d => ({ year: d.year, val: d.value }));
      const drawProfit = () => {
        const w = profitContainer.clientWidth;
        const h = 350;
        profitContainer.innerHTML = '';
        const svg = d3.select(profitContainer).append('svg').attr('width', w).attr('height', h);
        const m = { top: 25, right: 60, bottom: 35, left: 55 };
        const iw = w - m.left - m.right;
        const ih = h - m.top - m.bottom;
        const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);

        const x = d3.scaleBand().domain(pData.map(d => d.year)).range([0, iw]).padding(0.3);
        const y = d3.scaleLinear().domain([0, d3.max(pData, d => d.val) * 1.15]).range([ih, 0]);
        const y2 = d3.scaleLinear().domain([0, d3.max(mData, d => d.val) * 1.15]).range([ih, 0]);

        g.selectAll('.bar').data(pData).enter()
          .append('rect').attr('class','bar')
          .attr('x', d => x(d.year)).attr('width', x.bandwidth())
          .attr('y', ih).attr('height', 0)
          .attr('fill','var(--bull,#d4a34d)').attr('opacity',0.7)
          .transition().duration(800).delay((d,i) => i*120)
          .attr('y', d => y(d.val)).attr('height', d => ih - y(d.val));

        // Margin line
        const line = d3.line()
          .x(d => x(d.year) + x.bandwidth()/2).y(d => y2(d.val))
          .curve(d3.curveMonotoneX);
        g.append('path').datum(mData)
          .attr('fill','none').attr('stroke','var(--accent,#6b95c0)').attr('stroke-width',2.5)
          .attr('d', line);
        g.selectAll('.margin-dot').data(mData).enter()
          .append('circle')
          .attr('cx', d => x(d.year) + x.bandwidth()/2).attr('cy', d => y2(d.val))
          .attr('r', 4).attr('fill','var(--accent,#6b95c0)');
        g.append('text').attr('x', iw).attr('y', -2).attr('text-anchor','end')
          .attr('fill','var(--accent,#6b95c0)').style('font-size','12px')
          .text('PAT Margin %');

        g.append('g').attr('transform', `translate(0,${ih})`).call(d3.axisBottom(x).tickSize(0).tickPadding(6))
          .style('color','var(--text3,#6b655b)').style('font-size','13px');
        g.append('g').call(d3.axisLeft(y).ticks(5).tickFormat(d => '₹' + (d/1000).toFixed(0) + 'k Cr').tickSize(0).tickPadding(6))
          .style('color','var(--text3,#6b655b)').style('font-size','12px');
      };
      drawProfit();
      window.addEventListener('resize', drawProfit);
    }

    /* ── 5. RATIOS CHART ── */
    const ratiosContainer = document.getElementById('ratios-chart');
    if (ratiosContainer && cd.debtEquity && cd.debtEquity.length) {
      const deData = cd.debtEquity.map(d => ({ year: d.year, de: d.value, roe: cd.roe.find(r => r.year === d.year)?.value || 0 }));
      const drawRatios = () => {
        const w = ratiosContainer.clientWidth;
        const h = 300;
        ratiosContainer.innerHTML = '';
        const svg = d3.select(ratiosContainer).append('svg').attr('width', w).attr('height', h);
        const m = { top: 20, right: 20, bottom: 35, left: 50 };
        const iw = w - m.left - m.right;
        const ih = h - m.top - m.bottom;
        const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);

        // ROE bars (left axis)
        const x = d3.scaleBand().domain(deData.map(d => d.year)).range([0, iw]).padding(0.3);
        const y = d3.scaleLinear().domain([0, 55]).range([ih, 0]);
        g.selectAll('.bar-roe').data(deData).enter()
          .append('rect').attr('class','bar-roe')
          .attr('x', d => x(d.year)).attr('width', x.bandwidth())
          .attr('y', d => y(d.roe)).attr('height', d => ih - y(d.roe))
          .attr('fill','var(--bull,#d4a34d)').attr('opacity',0.6);
        // DE line
        const deLine = d3.line()
          .x(d => x(d.year) + x.bandwidth()/2).y(d => y(d.de * 400)) // scale DE up for visibility
          .curve(d3.curveMonotoneX);
        g.append('path').datum(deData).attr('fill','none').attr('stroke','var(--bear,#c0443b)').attr('stroke-width',2).attr('d', deLine());
        // Dots
        g.selectAll('.de-dot').data(deData).enter()
          .append('circle')
          .attr('cx', d => x(d.year) + x.bandwidth()/2).attr('cy', d => y(d.de * 400))
          .attr('r', 3).attr('fill','var(--bear,#c0443b)');

        // Label
        g.append('text').attr('x', iw-4).attr('y', -4).attr('text-anchor','end')
          .attr('fill','var(--text3,#6b655b)').style('font-size','11px')
          .text('Bars: ROE %  ·  Red line: Debt/Equity (×100)');

        g.append('g').attr('transform', `translate(0,${ih})`).call(d3.axisBottom(x).tickSize(0).tickPadding(6))
          .style('color','var(--text3,#6b655b)').style('font-size','13px');
        g.append('g').call(d3.axisLeft(y).ticks(5).tickFormat(d => d + '%').tickSize(0))
          .style('color','var(--text3,#6b655b)').style('font-size','12px');
      };
      drawRatios();
      window.addEventListener('resize', drawRatios);
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
      const drawOwn = () => {
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
          .attr('d', arc).attr('fill', d => d.data.color).attr('stroke','var(--bg,#12110f)').attr('stroke-width',2)
          .attr('opacity',0).transition().duration(600).delay((d,i) => i*100).attr('opacity',1);

        // Legend
        const legend = g.selectAll('.legend').data(ownData).enter()
          .append('g').attr('class','legend')
          .attr('transform', (d,i) => `translate(${radius + 30},${-radius + i*25})`);
        legend.append('rect').attr('width',12).attr('height',12).attr('rx',2).attr('fill', d => d.color);
        legend.append('text').attr('x',18).attr('y',11).attr('fill','var(--text2,#a8a096)').style('font-size','12px')
          .text(d => `${d.label}: ${d.val}%`);

        // Center text
        g.append('text').attr('text-anchor','middle').attr('y',-6)
          .attr('fill','var(--text,#e8e2d8)').style('font-size','22px').style('font-weight','700')
          .text('72.4%');
        g.append('text').attr('text-anchor','middle').attr('y',12)
          .attr('fill','var(--text2,#a8a096)').style('font-size','11px')
          .text('Promoter');
      };
      drawOwn();
      window.addEventListener('resize', drawOwn);
    }

    /* ── 7. TIMELINE FADE-IN ── */
    const timelineItems = document.querySelectorAll('.timeline-item');
    if (timelineItems.length) {
      const tlObs = new IntersectionObserver(entries => {
        entries.forEach(e => {
          if (e.isIntersecting) { e.target.classList.add('visible'); tlObs.unobserve(e.target); }
        });
      }, { threshold: 0.3 });
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
          { id: 'TCS', group: 'self', radius: 22 },
          { id: 'Tata Sons', group: 'promoter', radius: 16 },
          { id: 'Tata Motors', group: 'group', radius: 12 },
          { id: 'Tata Steel', group: 'group', radius: 12 },
          { id: 'Tata Power', group: 'group', radius: 12 },
          { id: 'Tata Comm', group: 'group', radius: 10 },
          { id: 'Tata Elxsi', group: 'group', radius: 10 },
          { id: 'Infosys', group: 'competitor', radius: 12 },
          { id: 'Wipro', group: 'competitor', radius: 12 },
          { id: 'HCL Tech', group: 'competitor', radius: 12 },
          { id: 'Tech M', group: 'competitor', radius: 10 },
          { id: 'BSE', group: 'exchange', radius: 10 },
          { id: 'NSE', group: 'exchange', radius: 10 },
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
        self: 'var(--bull,#d4a34d)',
        promoter: '#c0443b',
        group: '#6b95c0',
        competitor: '#68a88a',
        exchange: '#a08b6f'
      };

      function drawGraph() {
        const w = graphContainer.clientWidth;
        const h = Math.min(500, w * 0.6);
        graphContainer.innerHTML = '';
        const svg = d3.select(graphContainer).append('svg').attr('width', w).attr('height', h);

        const sim = d3.forceSimulation(graphData.nodes)
          .force('link', d3.forceLink(graphData.links).id(d => d.id).distance(80))
          .force('charge', d3.forceManyBody().strength(-250))
          .force('center', d3.forceCenter(w/2, h/2))
          .force('collide', d3.forceCollide(d => d.radius + 6));

        const link = svg.selectAll('.link').data(graphData.links).enter()
          .append('line').attr('class','link')
          .attr('stroke','var(--border,#3a3630)').attr('stroke-width',1.5).attr('stroke-opacity',0.5);

        const node = svg.selectAll('.node').data(graphData.nodes).enter()
          .append('circle').attr('class','node')
          .attr('r', d => d.radius).attr('fill', d => groupColors[d.group] || '#666')
          .attr('stroke','var(--bg,#12110f)').attr('stroke-width',2)
          .attr('cursor','pointer');

        const label = svg.selectAll('.nodelabel').data(graphData.nodes).enter()
          .append('text').attr('class','nodelabel')
          .text(d => d.id).attr('text-anchor','middle')
          .attr('fill','var(--text,#e8e2d8)').style('font-size','10px')
          .style('pointer-events','none');

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
        setTimeout(() => { if (graphContainer.innerHTML === '') cleanupGraph = drawGraph(); }, 100);
      });
      closeBtn.addEventListener('click', () => {
        overlay.classList.remove('open');
      });
      overlay.addEventListener('click', e => {
        if (e.target === overlay) overlay.classList.remove('open');
      });
    }

    /* ── 9. CARD FADE-IN ON SCROLL ── */
    const fadeCards = document.querySelectorAll('.data-card:not(.fade-in.visible)');
    if (fadeCards.length) {
      const fadeObs = new IntersectionObserver(entries => {
        entries.forEach(e => {
          if (e.isIntersecting) { e.target.classList.add('visible'); fadeObs.unobserve(e.target); }
        });
      }, { threshold: 0.3 });
      fadeCards.forEach(c => fadeObs.observe(c));
    }
  });
})();
