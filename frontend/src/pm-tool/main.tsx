import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import zhTW from 'antd/locale/zh_TW';
import 'antd/dist/reset.css';
import './styles.css';
import PmToolApp from './PmToolApp';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider locale={zhTW}>
      <PmToolApp />
    </ConfigProvider>
  </React.StrictMode>,
);
