package log

type ZapConfig struct {
	File       string //日志文件路径
	Console    bool   //是否输出到终端，用于命令行启动显示
	MaxAge     int32  //最大存放天数，0为长期保存
	Level      string //等级，默认info级别，有debug、info、warn、error等
	MaxSize    int32  //文件最大大小，M为单位
	MaxBackups int32  //日志文件最大滚动数

}

func (zap ZapConfig) GetMaxAge() int32 {
	if zap.MaxAge > 0 {
		return zap.MaxAge
	}
	return 30
}

func (zap ZapConfig) GetMaxSize() int32 {
	if zap.MaxSize > 0 {
		return zap.MaxSize
	}
	return 100 * 1024 * 1024
}
func (zap ZapConfig) GetMaxBackups() int32 {
	if zap.MaxBackups > 0 {
		return zap.MaxBackups
	}
	return 10
}
