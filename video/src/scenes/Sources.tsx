import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Space} from '../components/ui';
import {beats} from '../script';
import {sources} from '../facts';
import {C, F} from '../theme';

const b = beats.sources;

// 出典：動画に出した数字の元（curation/ のカードに付いている URL）
export const Sources: React.FC = () => (
	<AbsoluteFill>
		<Space drift={0} density={120} />
		<div style={{position: 'absolute', left: 140, top: 110, right: 140}}>
			<div style={{fontFamily: F.body, fontWeight: 700, fontSize: 40, color: C.text, marginBottom: 26}}>{b.title}</div>
			{sources.map((s) => (
				<div key={s.label} style={{display: 'flex', gap: 24, fontSize: 21, lineHeight: 1.75}}>
					<div style={{fontFamily: F.body, color: C.text, width: 560, flexShrink: 0}}>{s.label}</div>
					<div style={{fontFamily: F.mono, color: C.textDim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{s.url}</div>
				</div>
			))}
			<div style={{fontFamily: F.body, fontSize: 24, color: C.mint, marginTop: 30}}>{b.footer}</div>
			<div style={{fontFamily: F.body, fontSize: 20, color: C.textDim, marginTop: 10}}>{beats.cta.disclaimer}　VOYASCOPE（151Me）</div>
		</div>
	</AbsoluteFill>
);
