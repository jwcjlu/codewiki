import { AnswerReq, AnswerResp } from '../types';

// gRPC-Web客户端配置
const GRPC_SERVER_URL = 'http://localhost:9000';

// 简单的gRPC-Web客户端实现
export class GrpcClient {
  private baseUrl: string;

  constructor(baseUrl: string = GRPC_SERVER_URL) {
    this.baseUrl = baseUrl;
  }

  // 调用Answer接口的gRPC方法
  async answer(req: AnswerReq, onChunk?: (chunk: string, isComplete: boolean) => void): Promise<AnswerResp> {
    try {
      console.log('开始真正的gRPC调用:', req);
      
      // 使用gRPC-Web的HTTP/1.1模式
      const response = await fetch(`${this.baseUrl}/codewiki.v1.CodeWikiService/Answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/grpc-web+proto',
          'X-GRPC-Web': '1',
          'Origin': window.location.origin,
        },
        body: this.serializeGrpcRequest(req),
        mode: 'cors',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`gRPC调用失败: ${response.status} ${response.statusText}`);
      }

      // 处理gRPC流式响应
      return this.handleGrpcStreamResponse(response, onChunk);
    } catch (error) {
      console.error('gRPC调用错误:', error);
      throw error;
    }
  }

  // 序列化gRPC请求
  private serializeGrpcRequest(req: AnswerReq): Uint8Array {
    // 简单的protobuf序列化（这里使用JSON作为示例）
    // 在实际生产环境中，应该使用真正的protobuf序列化
    const message = {
      id: req.id,
      question: req.question,
    };
    
    // 转换为UTF-8字节数组
    const encoder = new TextEncoder();
    return encoder.encode(JSON.stringify(message));
  }

  // 处理gRPC流式响应
  private async handleGrpcStreamResponse(
    response: Response, 
    onChunk?: (chunk: string, isComplete: boolean) => void
  ): Promise<AnswerResp> {
    if (!response.body) {
      throw new Error('gRPC响应体为空');
    }

    return new Promise((resolve, reject) => {
      let fullAnswer = '';
      let isComplete = false;

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();

      const readStream = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              console.log('gRPC流式读取完成');
              if (!isComplete) {
                isComplete = true;
                onChunk?.(fullAnswer, true);
              }
              resolve({
                answer: fullAnswer,
                is_streaming: true,
                is_complete: true
              });
              break;
            }

            // 解码gRPC数据块
            const chunk = decoder.decode(value, { stream: true });
            console.log('收到gRPC数据块:', chunk);
            
            // 解析gRPC消息
            try {
              // 尝试解析为protobuf格式
              const parsed = this.parseGrpcMessage(chunk);
              if (parsed) {
                if (parsed.error) {
                  reject(new Error(parsed.error));
                  return;
                }

                if (parsed.chunk) {
                  fullAnswer += parsed.chunk;
                  onChunk?.(parsed.chunk, false);
                }

                if (parsed.is_complete) {
                  isComplete = true;
                  onChunk?.(parsed.chunk || fullAnswer, true);
                }
              } else {
                // 如果不是protobuf格式，作为纯文本处理
                fullAnswer += chunk;
                onChunk?.(chunk, false);
              }
            } catch (parseError) {
              console.log('解析gRPC消息失败，作为纯文本处理:', chunk);
              fullAnswer += chunk;
              onChunk?.(chunk, false);
            }
          }
        } catch (error) {
          console.error('gRPC流式读取错误:', error);
          reject(error);
        } finally {
          reader.releaseLock();
        }
      };

      readStream();
    });
  }

  // 解析gRPC消息
  private parseGrpcMessage(chunk: string): AnswerResp | null {
    try {
      // 尝试解析为JSON格式
      if (chunk.startsWith('data: ')) {
        const data = JSON.parse(chunk.slice(6));
        return data;
      }
      
      // 尝试直接解析JSON
      const data = JSON.parse(chunk);
      return data;
    } catch (error) {
      // 解析失败，返回null
      return null;
    }
  }
}

// 创建全局gRPC客户端实例
export const grpcClient = new GrpcClient();
