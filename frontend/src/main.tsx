import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import zhTW from 'antd/locale/zh_TW';
import 'antd/dist/reset.css';
import './styles.css';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider locale={zhTW}>
      <App />
    </ConfigProvider>
  </React.StrictMode>,
);
