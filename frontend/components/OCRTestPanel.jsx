import { useState } from 'react';
import OCRProcessor, { OCRStatus, OCRResults } from './OCRProcessor';

/**
 * OCR 测试面板 - 用于测试和调试 OCR 功能
 */
export default function OCRTestPanel({ onLocationsExtracted }) {
    const [testFiles, setTestFiles] = useState([]);
    const [ocrResults, setOCRResults] = useState(null);
    const [ocrError, setOCRError] = useState(null);
    const [showRawText, setShowRawText] = useState(false);

    // OCR 处理器
    const { processFiles, isProcessing, progress, currentFile, ocrMode, setOcrMode } = OCRProcessor({
        onOCRComplete: (results) => {
            console.log('OCR 处理完成:', results);
            setOCRResults(results);
            setOCRError(null);
            
            // 将提取的地点信息传递给父组件
            if (results.locations && results.locations.length > 0) {
                // 转换为地图组件需要的格式
                const mapLocations = convertOCRResultsToMapFormat(results);
                onLocationsExtracted?.(mapLocations);
            }
        },
        onError: (error) => {
            console.error('OCR 处理错误:', error);
            setOCRError(error);
            setOCRResults(null);
        }
    });

    /**
     * 将 OCR 结果转换为地图组件需要的格式
     */
    const convertOCRResultsToMapFormat = (ocrResults) => {
        return ocrResults.locations.map((location, index) => ({
            id: `ocr_${index}`,
            name: location.name,
            type: location.type === 'business' ? 'Business' : 
                  location.type === 'address' ? 'Address' : 'Location',
            address: location.name, // 暂时使用名称作为地址
            coordinates: null, // 需要后续地理编码
            extractedFrom: location.source || 'OCR',
            confidence: 0.8, // 默认置信度
            metadata: {
                ocr_type: location.type,
                source_file: location.source,
                needs_geocoding: true
            }
        }));
    };

    /**
     * 处理文件上传
     */
    const handleFileUpload = (event) => {
        const files = Array.from(event.target.files);
        setTestFiles(files);
        
        // 自动开始 OCR 处理
        if (files.length > 0) {
            processFiles(files);
        }
    };

    /**
     * 手动触发 OCR 处理
     */
    const handleProcessOCR = () => {
        if (testFiles.length > 0) {
            processFiles(testFiles);
        }
    };

    /**
     * 清除结果
     */
    const handleClearResults = () => {
        setOCRResults(null);
        setOCRError(null);
        setTestFiles([]);
    };

    /**
     * 地点选择处理
     */
    const handleLocationSelect = (location) => {
        console.log('选择的地点:', location);
        // 可以在这里添加更多的地点处理逻辑
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                    🔍 OCR 测试面板
                </h2>
                
                {/* OCR 模式切换 */}
                <div className="flex items-center space-x-2">
                    <label className="text-sm text-gray-600">模式:</label>
                    <select
                        value={ocrMode}
                        onChange={(e) => setOcrMode(e.target.value)}
                        className="text-sm border rounded px-2 py-1"
                    >
                        <option value="frontend">前端 (Tesseract.js)</option>
                        <option value="backend">后端 API</option>
                    </select>
                </div>
            </div>

            {/* 文件上传区域 */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    上传测试图片
                </label>
                <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                
                {testFiles.length > 0 && (
                    <div className="mt-2 text-sm text-gray-600">
                        已选择 {testFiles.length} 个文件: {testFiles.map(f => f.name).join(', ')}
                    </div>
                )}
            </div>

            {/* 控制按钮 */}
            <div className="flex space-x-3 mb-6">
                <button
                    onClick={handleProcessOCR}
                    disabled={testFiles.length === 0 || isProcessing}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isProcessing ? '处理中...' : '开始 OCR 处理'}
                </button>
                
                <button
                    onClick={handleClearResults}
                    className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                >
                    清除结果
                </button>
                
                {ocrResults && (
                    <button
                        onClick={() => setShowRawText(!showRawText)}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                        {showRawText ? '隐藏' : '显示'} 原始文本
                    </button>
                )}
            </div>

            {/* OCR 处理状态 */}
            <OCRStatus 
                isProcessing={isProcessing} 
                progress={progress} 
                currentFile={currentFile} 
            />

            {/* OCR 错误显示 */}
            {ocrError && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center">
                        <span className="text-red-500 mr-2">❌</span>
                        <span className="text-sm text-red-800">OCR 处理失败: {ocrError}</span>
                    </div>
                    <button
                        onClick={handleProcessOCR}
                        className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
                    >
                        重新处理
                    </button>
                </div>
            )}

            {/* OCR 结果显示 */}
            <OCRResults 
                results={ocrResults} 
                onLocationSelect={handleLocationSelect} 
            />

            {/* 详细结果展示 */}
            {ocrResults && (
                <div className="mt-6 space-y-4">
                    {/* 统计信息 */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <h3 className="text-sm font-medium text-gray-900 mb-2">处理统计</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                                <span className="text-gray-500">总文件:</span>
                                <span className="font-medium ml-1">{ocrResults.stats.totalFiles}</span>
                            </div>
                            <div>
                                <span className="text-gray-500">成功:</span>
                                <span className="font-medium ml-1 text-green-600">{ocrResults.stats.successfulFiles}</span>
                            </div>
                            <div>
                                <span className="text-gray-500">失败:</span>
                                <span className="font-medium ml-1 text-red-600">{ocrResults.stats.failedFiles}</span>
                            </div>
                            <div>
                                <span className="text-gray-500">平均置信度:</span>
                                <span className="font-medium ml-1">{(ocrResults.stats.averageConfidence * 100).toFixed(1)}%</span>
                            </div>
                        </div>
                    </div>

                    {/* 原始文本显示 */}
                    {showRawText && ocrResults.texts && (
                        <div className="bg-gray-50 p-4 rounded-lg">
                            <h3 className="text-sm font-medium text-gray-900 mb-2">原始 OCR 文本</h3>
                            <div className="space-y-3">
                                {ocrResults.texts.map((textResult, index) => (
                                    <div key={index} className="bg-white p-3 rounded border">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-medium text-gray-700">
                                                {textResult.filename}
                                            </span>
                                            <span className="text-xs text-gray-500">
                                                置信度: {(textResult.confidence * 100).toFixed(1)}%
                                            </span>
                                        </div>
                                        <div className="text-sm text-gray-800 whitespace-pre-wrap font-mono bg-gray-50 p-2 rounded max-h-32 overflow-y-auto">
                                            {textResult.cleanedText || textResult.rawText}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 提取的地理信息详情 */}
                    {ocrResults.locations && ocrResults.locations.length > 0 && (
                        <div className="bg-blue-50 p-4 rounded-lg">
                            <h3 className="text-sm font-medium text-blue-900 mb-2">
                                提取的地理信息 ({ocrResults.locations.length} 项)
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {ocrResults.locations.map((location, index) => (
                                    <div key={index} className="bg-white p-3 rounded border">
                                        <div className="font-medium text-sm">{location.name}</div>
                                        <div className="flex items-center mt-1">
                                            <span className={`text-xs px-2 py-1 rounded-full ${
                                                location.type === 'business' ? 'bg-blue-100 text-blue-700' :
                                                location.type === 'address' ? 'bg-green-100 text-green-700' :
                                                'bg-gray-100 text-gray-700'
                                            }`}>
                                                {location.type}
                                            </span>
                                            {location.source && (
                                                <span className="text-xs text-gray-500 ml-2">
                                                    {location.source}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}