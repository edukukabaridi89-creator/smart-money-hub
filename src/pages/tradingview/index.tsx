// @ts-nocheck
import React from 'react';
import { CHARTS_URL } from '@/nexus/config';

export const TradingView = () => <iframe className='nx-iframe' src={CHARTS_URL} title='TradingView' allow='fullscreen' />;
