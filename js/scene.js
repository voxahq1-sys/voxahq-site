/* VOXA — AI & automation themed 3D backgrounds.
   Every page runs its own WebGL scene, built around one idea from the AI world:
     flight   (home)    flying through a live neural network with data streams
     orbit    (about)   an AI core hub with orbiting model nodes
     wave     (contact) a signal grid of data with transmission pulses
     monolith (legal)   a calm data lattice
   Scene is chosen with data-scene on <body>.
*/
(function () {
  'use strict';
  var canvas = document.getElementById('gl');
  if (!canvas || typeof THREE === 'undefined') return;

  var mode = (document.body && document.body.getAttribute('data-scene')) || 'flight';
  window.__sceneMode = mode;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isSmall = window.innerWidth < 900;

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: !isSmall, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSmall ? 1.5 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 320);
  var world = new THREE.Group();
  scene.add(world);

  // palette: signal cyan, brand lime, model violet, data white
  var CYAN = 0x22d3ee, LIME = 0xc8f751, VIOLET = 0x6c4cff, INK = 0xf4f4f1;
  var visible = true;
  document.addEventListener('visibilitychange', function () { visible = !document.hidden; });

  /* ---------- shared builders ---------- */
  function haze(count, rMin, rMax, spreadY, zFrom, zTo, color, size, opacity) {
    var pos = new Float32Array(count * 3);
    for (var i = 0; i < count; i++) {
      var a = Math.random() * Math.PI * 2;
      var r = rMin + Math.random() * (rMax - rMin);
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = (Math.random() - 0.5) * spreadY;
      pos[i * 3 + 2] = zFrom - Math.random() * (zFrom - zTo);
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({
      color: color, size: size, sizeAttenuation: true, transparent: true,
      opacity: opacity, blending: THREE.AdditiveBlending, depthWrite: false
    }));
  }

  function coreMaterial(colorA, colorB, rim, amp) {
    var VERT = [
      'uniform float uTime;', 'uniform float uAmp;',
      'varying vec3 vNormal;', 'varying vec3 vPos;', 'varying float vD;',
      'void main() {',
      '  vec3 p = position;',
      '  float d = sin(p.x * 2.4 + uTime * 1.1) * cos(p.y * 2.6 + uTime * 0.9) * sin(p.z * 2.2 + uTime * 0.7);',
      '  d += 0.32 * sin(p.y * 5.0 + uTime * 1.7);',
      '  d += 0.16 * cos(p.x * 7.0 - uTime * 1.3);',
      '  p += normal * d * uAmp;',
      '  vD = d;',
      '  vNormal = normalize(normalMatrix * normal);',
      '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
      '  vPos = mv.xyz;',
      '  gl_Position = projectionMatrix * mv;',
      '}'
    ].join('\n');
    var FRAG = [
      'uniform float uTime;', 'uniform vec3 uColorA;', 'uniform vec3 uColorB;', 'uniform vec3 uRim;',
      'varying vec3 vNormal;', 'varying vec3 vPos;', 'varying float vD;',
      'void main() {',
      '  vec3 n = normalize(vNormal);',
      '  vec3 v = normalize(-vPos);',
      '  float fres = pow(1.0 - max(dot(n, v), 0.0), 2.2);',
      '  vec3 col = mix(uColorA, uColorB, smoothstep(-0.7, 0.9, vD));',
      '  col += uRim * fres * 1.25;',
      '  float scan = 0.5 + 0.5 * sin(vPos.y * 22.0 - uTime * 3.0);',
      '  col += vec3(0.02, 0.05, 0.06) * scan;',
      '  gl_FragColor = vec4(col, 1.0);',
      '}'
    ].join('\n');
    return new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG,
      uniforms: {
        uTime: { value: 0 }, uAmp: { value: amp },
        uColorA: { value: new THREE.Color(colorA) },
        uColorB: { value: new THREE.Color(colorB) },
        uRim: { value: new THREE.Color(rim) }
      }
    });
  }

  // falling data streaks: reads instantly as "machine is working"
  function dataStreaks(n, xSpread, yFrom, yTo, zFrom, zTo, color, opacity) {
    var geo = new THREE.BufferGeometry();
    var pos = new Float32Array(n * 6);
    var state = [];
    for (var i = 0; i < n; i++) {
      var x = (Math.random() - 0.5) * xSpread;
      var z = zFrom - Math.random() * (zFrom - zTo);
      var y = yFrom - Math.random() * (yFrom - yTo);
      var len = 0.5 + Math.random() * 1.6;
      var speed = 0.006 + Math.random() * 0.022;
      pos[i * 6] = x; pos[i * 6 + 1] = y; pos[i * 6 + 2] = z;
      pos[i * 6 + 3] = x; pos[i * 6 + 4] = y - len; pos[i * 6 + 5] = z;
      state.push({ len: len, speed: speed, top: yFrom, bottom: yTo });
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
      color: color, transparent: true, opacity: opacity, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    lines.userData.tick = function () {
      var a = geo.attributes.position.array;
      for (var i = 0; i < n; i++) {
        a[i * 6 + 1] -= state[i].speed;
        a[i * 6 + 4] -= state[i].speed;
        if (a[i * 6 + 1] < state[i].bottom) {
          a[i * 6 + 1] = state[i].top;
          a[i * 6 + 4] = state[i].top - state[i].len;
        }
      }
      geo.attributes.position.needsUpdate = true;
    };
    return lines;
  }

  // a cluster of nodes wired to their nearest neighbours, with packets travelling the wires
  function neuralCloud(opts) {
    var group = new THREE.Group();
    var nodes = [];
    var n = opts.nodes;
    for (var i = 0; i < n; i++) {
      var t = i / n;
      nodes.push({
        x: (Math.random() - 0.5) * opts.spreadX,
        y: (Math.random() - 0.5) * opts.spreadY,
        z: opts.zFrom - t * opts.zLength - Math.random() * 3
      });
    }
    var nodePos = new Float32Array(n * 3);
    for (var j = 0; j < n; j++) {
      nodePos[j * 3] = nodes[j].x; nodePos[j * 3 + 1] = nodes[j].y; nodePos[j * 3 + 2] = nodes[j].z;
    }
    var nodeGeo = new THREE.BufferGeometry();
    nodeGeo.setAttribute('position', new THREE.BufferAttribute(nodePos, 3));
    var points = new THREE.Points(nodeGeo, new THREE.PointsMaterial({
      color: CYAN, size: opts.nodeSize, sizeAttenuation: true, transparent: true,
      opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    group.add(points);

    var pairs = [];
    var maxDist = opts.linkDistance;
    for (var a = 0; a < n; a++) {
      var links = 0;
      for (var b = a + 1; b < n && links < 2; b++) {
        var dx = nodes[a].x - nodes[b].x, dy = nodes[a].y - nodes[b].y, dz = nodes[a].z - nodes[b].z;
        if (Math.sqrt(dx * dx + dy * dy + dz * dz) < maxDist) { pairs.push([a, b]); links++; }
      }
    }
    var linePos = new Float32Array(pairs.length * 6);
    for (var p2 = 0; p2 < pairs.length; p2++) {
      var A = nodes[pairs[p2][0]], B = nodes[pairs[p2][1]];
      linePos[p2 * 6] = A.x; linePos[p2 * 6 + 1] = A.y; linePos[p2 * 6 + 2] = A.z;
      linePos[p2 * 6 + 3] = B.x; linePos[p2 * 6 + 4] = B.y; linePos[p2 * 6 + 5] = B.z;
    }
    var lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
    group.add(new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({
      color: LIME, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false
    })));

    // data packets running along the wires
    var packets = [];
    var packetCount = Math.max(6, Math.round(pairs.length * 0.18));
    for (var k = 0; k < packetCount; k++) {
      var m = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), new THREE.MeshBasicMaterial({ color: p2 % 2 ? LIME : INK, transparent: true, opacity: 0.95 }));
      group.add(m);
      packets.push({ mesh: m, pair: pairs[Math.floor(Math.random() * pairs.length)], t: Math.random(), speed: 0.004 + Math.random() * 0.012 });
    }
    group.userData.tick = function () {
      for (var i = 0; i < packets.length; i++) {
        var pk = packets[i];
        pk.t += pk.speed;
        if (pk.t > 1) { pk.t = 0; pk.pair = pairs[Math.floor(Math.random() * pairs.length)]; }
        var A2 = nodes[pk.pair[0]], B2 = nodes[pk.pair[1]];
        pk.mesh.position.set(
          A2.x + (B2.x - A2.x) * pk.t,
          A2.y + (B2.y - A2.y) * pk.t,
          A2.z + (B2.z - A2.z) * pk.t
        );
      }
    };
    return group;
  }

  /* ================= HOME: neural flight ================= */
  function sceneFlight() {
    scene.fog = new THREE.FogExp2(0x06080a, 0.011);

    var cloud = neuralCloud({
      nodes: isSmall ? 44 : 120,
      spreadX: 26, spreadY: 13, zFrom: 4, zLength: 130,
      linkDistance: 6.0, nodeSize: 0.14
    });
    world.add(cloud);

    var cloud2 = neuralCloud({
      nodes: isSmall ? 22 : 54,
      spreadX: 34, spreadY: 18, zFrom: -20, zLength: 120,
      linkDistance: 7.0, nodeSize: 0.1
    });
    world.add(cloud2);

    var core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.9, isSmall ? 12 : 30), coreMaterial('#062a3a', '#22d3ee', '#c8f751', 0.26));
    world.add(core);
    var coreShell = new THREE.Mesh(new THREE.IcosahedronGeometry(1.9, 2), new THREE.MeshBasicMaterial({ color: LIME, wireframe: true, transparent: true, opacity: 0.22 }));
    coreShell.scale.setScalar(1.28);
    world.add(coreShell);

    var rings = new THREE.Group();
    world.add(rings);
    var ringCols = [CYAN, LIME, VIOLET];
    for (var r = 0; r < 3; r++) {
      var ring = new THREE.Mesh(new THREE.TorusGeometry(2.6 + r * 0.5, 0.009, 2, 128), new THREE.MeshBasicMaterial({ color: ringCols[r], transparent: true, opacity: 0.5 }));
      ring.rotation.set(Math.PI / 2 + r * 0.5, r * 0.7, r * 0.35);
      rings.add(ring);
    }

    // cinematic tunnel of gates the camera flies through
    var tunnel = new THREE.Group();
    world.add(tunnel);
    var gateCount = isSmall ? 9 : 15;
    var gateCols = [CYAN, LIME, VIOLET, INK];
    for (var q = 0; q < gateCount; q++) {
      var gate = new THREE.Mesh(
        new THREE.TorusGeometry(3.2 + (q % 3) * 0.6, 0.03, 2, 72),
        new THREE.MeshBasicMaterial({ color: gateCols[q % gateCols.length], transparent: true, opacity: 0.95 })
      );
      gate.position.set((Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 1.6, 1.5 - q * 7.2);
      gate.rotation.z = Math.random() * Math.PI;
      gate.userData.spin = (Math.random() - 0.5) * 0.6;
      tunnel.add(gate);
    }

    // solid shapes drifting past for depth and parallax
    var solidGeos = [
      new THREE.IcosahedronGeometry(0.55, 0),
      new THREE.BoxGeometry(0.6, 0.6, 0.6),
      new THREE.OctahedronGeometry(0.5),
      new THREE.TorusKnotGeometry(0.32, 0.09, 48, 8)
    ];
    var drifting = [];
    var driftCount = isSmall ? 8 : 22;
    for (var d2 = 0; d2 < driftCount; d2++) {
      var dg = solidGeos[d2 % solidGeos.length];
      var dm = (d2 % 4 === 0)
        ? new THREE.MeshBasicMaterial({ color: 0x0d1b24 })
        : new THREE.MeshBasicMaterial({ color: gateCols[d2 % 3], wireframe: true, transparent: true, opacity: 0.85 });
      var dm2 = new THREE.Mesh(dg, dm);
      var ang2 = Math.random() * Math.PI * 2;
      var rad2 = 3.8 + Math.random() * 7;
      dm2.position.set(Math.cos(ang2) * rad2, (Math.random() - 0.5) * 10, -6 - d2 * (92 / driftCount) - Math.random() * 3);
      dm2.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      dm2.userData.spin = { x: (Math.random() - 0.5) * 0.6, y: (Math.random() - 0.5) * 0.7, z: (Math.random() - 0.5) * 0.5 };
      dm2.userData.baseY = dm2.position.y;
      dm2.userData.bob = Math.random() * Math.PI * 2;
      world.add(dm2);
      drifting.push(dm2);
    }

    var streaks = dataStreaks(isSmall ? 26 : 70, 40, 16, -14, 8, -120, CYAN, 0.5);
    world.add(streaks);

    var grid = new THREE.GridHelper(320, 80, 0x1b3b45, 0x0f2027);
    grid.position.set(0, -8.5, -55);
    grid.material.transparent = true; grid.material.opacity = 0.5;
    world.add(grid);

    world.add(haze(isSmall ? 900 : 2400, 1.5, 18, 26, 8, -150, 0xbfe9ff, 0.06, 0.8));

    return {
      update: function (t, smooth, mx, my) {
        core.material.uniforms.uTime.value = t;
        core.material.uniforms.uAmp.value = 0.24 + Math.sin(t * 0.7) * 0.06;
        core.rotation.y = t * 0.2 + mx * 0.6;
        core.rotation.x = my * 0.4 + Math.sin(t * 0.3) * 0.07;
        var fade = Math.max(0, 1 - smooth * 5.5);
        var s = 0.85 + fade * 0.4;
        core.scale.setScalar(s);
        coreShell.rotation.copy(core.rotation);
        coreShell.scale.setScalar(s * 1.28);
        rings.rotation.z = t * 0.14;
        rings.rotation.x = Math.sin(t * 0.2) * 0.15 + my * 0.2;
        rings.rotation.y = t * 0.07 + mx * 0.3;
        cloud.userData.tick();
        cloud2.userData.tick();
        streaks.userData.tick();
        for (var gi = 0; gi < tunnel.children.length; gi++) {
          var gt = tunnel.children[gi];
          gt.rotation.z += gt.userData.spin * 0.004;
          gt.rotation.x = Math.sin(t * 0.3 + gi) * 0.14;
          gt.rotation.y = Math.cos(t * 0.24 + gi * 0.7) * 0.14;
        }
        for (var di = 0; di < drifting.length; di++) {
          var dr = drifting[di];
          dr.rotation.x += dr.userData.spin.x * 0.01;
          dr.rotation.y += dr.userData.spin.y * 0.01;
          dr.rotation.z += dr.userData.spin.z * 0.01;
          dr.position.y = dr.userData.baseY + Math.sin(t * 0.6 + dr.userData.bob) * 0.35;
        }
        grid.position.z = -55 + smooth * 36;
        var z = 9 - smooth * 104;
        camera.position.set(Math.sin(smooth * Math.PI * 2.1) * 1.8 + mx * 0.8, Math.cos(smooth * Math.PI * 1.7) * 1.1 - my * 0.5, z);
        camera.lookAt(camera.position.x * 0.25 + mx * 0.6, camera.position.y * 0.25 - my * 0.4, z - 7);
      }
    };
  }

  /* ================= ABOUT: AI core hub ================= */
  function sceneOrbit() {
    scene.fog = new THREE.FogExp2(0x06080a, 0.013);

    var coreGeo = new THREE.IcosahedronGeometry(2.0, isSmall ? 18 : 44);
    var core = new THREE.Mesh(coreGeo, coreMaterial('#062a3a', '#1a7fd4', '#c8f751', 0.15));
    world.add(core);
    var shell = new THREE.Mesh(new THREE.IcosahedronGeometry(2.22, 3), new THREE.MeshBasicMaterial({ color: CYAN, wireframe: true, transparent: true, opacity: 0.2 }));
    world.add(shell);
    var inner = new THREE.Mesh(new THREE.SphereGeometry(1.88, 28, 28), new THREE.MeshBasicMaterial({ color: 0x081420, transparent: true, opacity: 0.9 }));
    world.add(inner);

    var orbitRadii = [3.3, 4.5, 5.8];
    var orbitCols = [CYAN, LIME, VIOLET];
    var pivots = [];
    for (var o = 0; o < 3; o++) {
      var ringMesh = new THREE.Mesh(new THREE.TorusGeometry(orbitRadii[o], 0.011, 2, 160), new THREE.MeshBasicMaterial({ color: orbitCols[o], transparent: true, opacity: 0.55 }));
      ringMesh.rotation.x = Math.PI / 2 + (o - 1) * 0.35;
      ringMesh.rotation.z = o * 0.5;
      world.add(ringMesh);

      var pivot = new THREE.Group();
      pivot.rotation.x = (o - 1) * 0.35;
      pivot.rotation.z = o * 0.5;
      world.add(pivot);

      var count = isSmall ? 3 : 5;
      var linkPos = new Float32Array(count * 6);
      var sats = [];
      for (var s2 = 0; s2 < count; s2++) {
        var angle = (s2 / count) * Math.PI * 2 + Math.random();
        var sx = Math.cos(angle) * orbitRadii[o], sz = Math.sin(angle) * orbitRadii[o];
        var node = new THREE.Mesh(
          s2 % 2 ? new THREE.OctahedronGeometry(0.15 + Math.random() * 0.09)
                 : new THREE.BoxGeometry(0.22, 0.22, 0.22),
          new THREE.MeshBasicMaterial({ color: s2 % 3 === 0 ? INK : orbitCols[o], transparent: true, opacity: 0.95 })
        );
        node.position.set(sx, 0, sz);
        pivot.add(node);
        sats.push({ mesh: node, angle: angle, radius: orbitRadii[o] });
        linkPos[s2 * 6] = 0; linkPos[s2 * 6 + 1] = 0; linkPos[s2 * 6 + 2] = 0;
        linkPos[s2 * 6 + 3] = sx; linkPos[s2 * 6 + 4] = 0; linkPos[s2 * 6 + 5] = sz;
      }
      var linkGeo = new THREE.BufferGeometry();
      linkGeo.setAttribute('position', new THREE.BufferAttribute(linkPos, 3));
      pivot.add(new THREE.LineSegments(linkGeo, new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false })));
      pivots.push({ group: pivot, sats: sats, links: linkGeo });
    }

    // data packets riding the orbit rings
    var packets = [];
    var packetColors = [LIME, INK, CYAN];
    for (var pk = 0; pk < 9; pk++) {
      var m = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 6), new THREE.MeshBasicMaterial({ color: packetColors[pk % 3], transparent: true, opacity: 0.95 }));
      world.add(m);
      packets.push({ mesh: m, radius: orbitRadii[pk % 3], angle: Math.random() * Math.PI * 2, speed: 0.12 + Math.random() * 0.22, tilt: (pk % 3 - 1) * 0.35, roll: Math.floor(pk / 3) * 0.5 });
    }

    world.add(haze(isSmall ? 420 : 1100, 3, 16, 18, 6, -36, 0xbfe9ff, 0.055, 0.7));

    return {
      update: function (t, smooth, mx, my) {
        core.material.uniforms.uTime.value = t;
        core.material.uniforms.uAmp.value = 0.13 + Math.sin(t * 0.5) * 0.03;
        core.rotation.y = t * 0.09;
        core.rotation.x = Math.sin(t * 0.13) * 0.06;
        shell.rotation.y = -t * 0.06 + mx * 0.25;
        shell.rotation.x = my * 0.2;
        for (var i = 0; i < pivots.length; i++) {
          pivots[i].group.rotation.y = t * (0.1 + i * 0.06) * (i % 2 ? -1 : 1);
          for (var s = 0; s < pivots[i].sats.length; s++) {
            var sat = pivots[i].sats[s];
            var a = sat.angle + t * (0.12 + s * 0.03);
            sat.mesh.position.set(Math.cos(a) * sat.radius, Math.sin(t * 0.6 + s) * 0.25, Math.sin(a) * sat.radius);
            var arr = pivots[i].links.attributes.position.array;
            arr[s * 6 + 3] = sat.mesh.position.x;
            arr[s * 6 + 4] = sat.mesh.position.y;
            arr[s * 6 + 5] = sat.mesh.position.z;
          }
          pivots[i].links.attributes.position.needsUpdate = true;
        }
        for (var p = 0; p < packets.length; p++) {
          var q = packets[p];
          q.angle += q.speed * 0.01;
          var x = Math.cos(q.angle) * q.radius;
          var zz = Math.sin(q.angle) * q.radius;
          packets[p].mesh.position.set(x, Math.sin(q.angle + q.roll) * q.radius * Math.sin(q.tilt), zz);
        }
        var dist = 9.6 - smooth * 2.6;
        var ang = t * 0.05 + smooth * 1.5 + mx * 0.35;
        camera.position.set(Math.sin(ang) * dist, 1.6 + Math.sin(t * 0.09) * 0.9 - my * 1.1, Math.cos(ang) * dist);
        camera.lookAt(0, 0, 0);
      }
    };
  }

  /* ================= CONTACT: signal grid ================= */
  function sceneWave() {
    scene.fog = new THREE.FogExp2(0x06080a, 0.019);

    var cols = isSmall ? 56 : 104;
    var rows = isSmall ? 30 : 54;
    var total = cols * rows;
    var pos = new Float32Array(total * 3);
    var base = new Float32Array(total * 2);
    var k = 0;
    for (var ix = 0; ix < cols; ix++) {
      for (var iz = 0; iz < rows; iz++) {
        var x = (ix / (cols - 1) - 0.5) * 46;
        var z = (iz / (rows - 1)) * -74 + 6;
        base[k * 2] = x; base[k * 2 + 1] = z;
        pos[k * 3] = x; pos[k * 3 + 1] = 0; pos[k * 3 + 2] = z;
        k++;
      }
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var grid = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xbfe9ff, size: isSmall ? 0.16 : 0.13, sizeAttenuation: true,
      transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    world.add(grid);
    world.add(new THREE.Points(geo, new THREE.PointsMaterial({
      color: CYAN, size: isSmall ? 0.4 : 0.34, sizeAttenuation: true,
      transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false
    })));

    // connection mesh so the surface reads as a data matrix, not just dots
    var stride = isSmall ? 4 : 3;
    var segs = [];
    for (var c = 0; c < cols; c += stride) {
      for (var rr = 0; rr < rows - 1; rr++) segs.push([c * rows + rr, c * rows + rr + 1]);
    }
    for (var r2 = 0; r2 < rows; r2 += stride) {
      for (var c2 = 0; c2 < cols - 1; c2++) segs.push([c2 * rows + r2, (c2 + 1) * rows + r2]);
    }
    var linePos = new Float32Array(segs.length * 6);
    var lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
    var mesh = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({
      color: CYAN, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    world.add(mesh);

    // transmission pulses travelling outward from the centre
    var pulses = [];
    for (var pi = 0; pi < 5; pi++) {
      var pr = new THREE.Mesh(new THREE.TorusGeometry(1, 0.018, 2, 96), new THREE.MeshBasicMaterial({ color: pi % 2 ? LIME : CYAN, transparent: true, opacity: 0.5 }));
      pr.rotation.x = -Math.PI / 2;
      pr.position.set((Math.random() - 0.5) * 8, 0.2, -3 - pi * 10);
      pr.userData.phase = pi * 1.3;
      world.add(pr);
      pulses.push(pr);
    }

    var streaks = dataStreaks(isSmall ? 14 : 34, 46, 14, -10, 4, -60, LIME, 0.3);
    world.add(streaks);
    world.add(haze(isSmall ? 220 : 600, 2, 18, 24, 6, -40, 0xbfe9ff, 0.11, 0.4));

    function height(bx, bz, t) {
      return Math.sin(bx * 0.32 + t * 0.85) * 0.85 +
             Math.cos(bz * 0.24 - t * 0.6) * 0.75 +
             Math.sin((bx + bz) * 0.14 + t * 0.4) * 0.5;
    }

    return {
      update: function (t, smooth, mx, my) {
        var arr = geo.attributes.position.array;
        for (var i = 0; i < total; i++) {
          arr[i * 3 + 1] = height(base[i * 2], base[i * 2 + 1], t);
        }
        geo.attributes.position.needsUpdate = true;

        var lp = lineGeo.attributes.position.array;
        for (var s = 0; s < segs.length; s++) {
          var a1 = segs[s][0], b1 = segs[s][1];
          lp[s * 6] = arr[a1 * 3]; lp[s * 6 + 1] = arr[a1 * 3 + 1]; lp[s * 6 + 2] = arr[a1 * 3 + 2];
          lp[s * 6 + 3] = arr[b1 * 3]; lp[s * 6 + 4] = arr[b1 * 3 + 1]; lp[s * 6 + 5] = arr[b1 * 3 + 2];
        }
        lineGeo.attributes.position.needsUpdate = true;

        for (var p = 0; p < pulses.length; p++) {
          var pl = pulses[p];
          var life = ((t * 0.3 + pl.userData.phase) % 1);
          pl.scale.setScalar(0.6 + life * 9);
          pl.material.opacity = 0.5 * (1 - life);
        }
        streaks.userData.tick();

        var z = 7 - smooth * 8;
        camera.position.set(Math.sin(smooth * 1.6) * 2.2 + mx * 1.6, 5.4 - smooth * 0.9 - my * 1.1, z);
        camera.lookAt(mx * 1.4, 0.1 - my * 0.5, z - 17);
      }
    };
  }

  /* ================= LEGAL: data lattice ================= */
  function sceneMonolith() {
    scene.fog = new THREE.FogExp2(0x06080a, 0.015);

    var lattice = new THREE.Group();
    world.add(lattice);
    var sizes = [3.4, 2.5, 1.7];
    var colsL = [CYAN, VIOLET, LIME];
    for (var b = 0; b < 3; b++) {
      var box = new THREE.Mesh(
        new THREE.BoxGeometry(sizes[b], sizes[b], sizes[b]),
        new THREE.MeshBasicMaterial({ color: colsL[b], wireframe: true, transparent: true, opacity: 0.46 - b * 0.08 })
      );
      box.userData.spin = (0.05 + b * 0.03) * (b % 2 ? -1 : 1);
      lattice.add(box);
    }

    // nodes at the lattice corners
    var cornerPos = [];
    var h = 1.7;
    for (var ci = -1; ci <= 1; ci += 2) {
      for (var cj = -1; cj <= 1; cj += 2) {
        for (var ck = -1; ck <= 1; ck += 2) {
          cornerPos.push(ci * h, cj * h, ck * h);
        }
      }
    }
    var cGeo = new THREE.BufferGeometry();
    cGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cornerPos), 3));
    lattice.add(new THREE.Points(cGeo, new THREE.PointsMaterial({
      color: INK, size: 0.13, sizeAttenuation: true, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false
    })));

    var core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.95, isSmall ? 6 : 16), coreMaterial('#062a3a', '#22d3ee', '#c8f751', 0.2));
    world.add(core);

    var ring = new THREE.Mesh(new THREE.TorusGeometry(4.3, 0.013, 2, 160), new THREE.MeshBasicMaterial({ color: LIME, transparent: true, opacity: 0.4 }));
    ring.rotation.x = Math.PI / 2.35;
    world.add(ring);

    world.add(dataStreaks(isSmall ? 10 : 26, 22, 10, -9, 3, -22, CYAN, 0.3));
    world.add(haze(isSmall ? 260 : 700, 3, 14, 16, 5, -26, 0xbfe9ff, 0.05, 0.6));

    return {
      update: function (t, smooth, mx, my) {
        for (var i = 0; i < lattice.children.length; i++) {
          var child = lattice.children[i];
          if (child.userData.spin) {
            child.rotation.y = t * child.userData.spin + mx * 0.25;
            child.rotation.x = t * child.userData.spin * 0.6 + my * 0.18;
          }
        }
        lattice.rotation.y = t * 0.03;
        core.rotation.y = t * 0.18;
        core.material.uniforms.uTime.value = t;
        core.material.uniforms.uAmp.value = 0.18 + Math.sin(t * 0.5) * 0.04;
        ring.rotation.z = t * 0.05;
        var dist = 10.4 - smooth * 1.2;
        var ang = t * 0.025 + smooth * 0.5;
        camera.position.set(Math.sin(ang) * dist + mx * 1.2, 1.2 + Math.sin(t * 0.07) * 0.6 - my * 0.9, Math.cos(ang) * dist);
        camera.lookAt(0, 0, 0);
      }
    };
  }

  var active = (mode === 'orbit') ? sceneOrbit()
             : (mode === 'wave') ? sceneWave()
             : (mode === 'monolith') ? sceneMonolith()
             : sceneFlight();

  /* ---------- shared input + loop ---------- */
  var target = 0, smooth = 0, tx = 0, ty = 0, mx = 0, my = 0;
  function progress() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    return max > 0 ? Math.min(Math.max((window.scrollY || 0) / max, 0), 1) : 0;
  }
  target = progress();
  window.addEventListener('scroll', function () { target = progress(); }, { passive: true });
  window.addEventListener('pointermove', function (e) {
    tx = (e.clientX / window.innerWidth - 0.5) * 2;
    ty = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });
  window.addEventListener('resize', function () {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    target = progress();
  });

  var clock = new THREE.Clock();
  /* adaptive frame skipping: weak devices render every other frame */
  var lastFrameTs = 0, avgFrameMs = 16, frameIndex = 0;
  function frame() {
    requestAnimationFrame(frame);
    if (!visible) return;
    var nowTs = (window.performance && performance.now) ? performance.now() : Date.now();
    if (lastFrameTs) { avgFrameMs = avgFrameMs * 0.9 + (nowTs - lastFrameTs) * 0.1; }
    lastFrameTs = nowTs;
    frameIndex++;
    if (avgFrameMs > 26 && (frameIndex % 2 === 1)) return;
    var t = clock.getElapsedTime();
    smooth += (target - smooth) * 0.07;
    mx += (tx - mx) * 0.05;
    my += (ty - my) * 0.05;
    active.update(t, smooth, mx, my);
    renderer.render(scene, camera);
  }
  if (reduced) { active.update(0, 0, 0, 0); renderer.render(scene, camera); } else { frame(); }
})();
