// SSE流式调用测试脚本
const fetch = require('node-fetch');

const API_BASE_URL = 'http://localhost:8000/v1/api';

async function testSSEAnswer() {
  try {
    console.log('开始测试SSE Answer接口...');
    
    // 测试SSE接口
    const response = await fetch(`${API_BASE_URL}/project/test-project/answer?question=测试问题`, {
      method: 'GET',
      headers: {
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Origin': 'http://localhost:3000',
      },
    });

    console.log('SSE响应状态:', response.status, response.statusText);
    console.log('SSE响应头:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      throw new Error(`SSE调用失败: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    console.log('Content-Type:', contentType);

    if (contentType && contentType.includes('text/event-stream')) {
      console.log('✅ 收到SSE响应');
    } else {
      console.log('ℹ️  收到其他类型响应');
    }

    // 尝试读取SSE流
    if (response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            console.log('SSE流读取完成');
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          console.log('SSE数据块:', chunk);
          
          // 解析SSE格式
          const lines = chunk.split('\n').filter(line => line.trim());
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                console.log('解析的SSE数据:', data);
              } catch (e) {
                console.log('非JSON SSE数据:', line.slice(6));
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    }

    console.log('✅ SSE调用测试完成');
  } catch (error) {
    console.error('❌ SSE调用测试失败:', error.message);
  }
}

// 运行测试
testSSEAnswer();
