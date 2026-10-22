import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Space} from '../components/ui';
import {BrandIcon} from '../components/Chrome';
import {beats} from '../script';
import {sources} from '../facts';
import {C, F} from '../theme';

const b = beats.sources;

// 出典：動画に出した数字の元（curation/ のカードに付いている URL）。2列で、読める大きさに
export const Sources: React.FC = () => (
	<AbsoluteFill>
		<Space drift={0} density={120} />
		<div style={{position: 'absolute', left: 96, right: 96, top: 80}}>
			<div style={{display: 'flex', alignItems: 'center', gap: 18, marginBottom: 34}}>
				<BrandIcon size={56} />
				<span style={{fontFamily: F.body, fontWeight: 700, fontSize: 46, color: C.text}}>{b.title}</span>
			</div>
			<div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 64, rowGap: 22}}>
				{sources.map((s) => (
					<div key={s.label} style={{borderLeft: `3px solid ${C.mintDim}`, paddingLeft: 16, minWidth: 0}}>
						<div style={{fontFamily: F.body, fontSize: 25, color: C.text, lineHeight: 1.35}}>{s.label}</div>
						<div style={{fontFamily: F.mono, fontSize: 17, color: C.textDim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
							{s.url.replace(/^https:\/\//, '')}
						</div>
					</div>
				))}
			</div>
			<div style={{fontFamily: F.body, fontSize: 26, color: C.mint, marginTop: 40}}>{b.footer}</div>
			<div style={{fontFamily: F.body, fontSize: 22, color: C.textDim, marginTop: 10}}>{b.credit}</div>
		</div>
	</AbsoluteFill>
);
