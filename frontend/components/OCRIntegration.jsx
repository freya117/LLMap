import { useState, useCallback } from 'react';
import OCRProcessor, { OCRStatus, OCRResults } from './OCRProcessor';

/**
 * OCR 集成组件 - 统一前后端 OCR 功能
 * 支持前端 Tesseract.js 和后端 API 两种模式
 */
export default function OCRIntegration({ onLocationsExtracted, onError }) {
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [ocrResults, setOcrResults] = useState(null);
    const [processingMode, setProcessingMode] = useState('frontend'); // 'frontend' 或 'backend'
    const [ocrEngine, setOcrEngine] = useState('auto'); // 'tesseract', 'paddle', 'auto'
    const [availableEngines, setAvailableEngines] = useState(null);
    const [isLoadingEngines, setIsLoadingEngines] = useState(false);

    // 初始化 OCR 处理器
    const ocrProcessor = OCRProcessor({
        onOCRComplete: handleOCRComplete,
        onError: handleOCRError
    });

    /**
     * 获取可用的 OCR 引擎信息
     */
    const fetchAvailableEngines = useCallback(async () => {
        if (processingMode !== 'backend') return;
        
        setIsLoadingEngines(true);
        try {
            const response = await fetch('http://localhost:8000/api/ocr/engines');
            if (response.ok) {
                const data = await response.json();
                setAvailableEngines(data);
                setOcrEngine(data.recommended || 'auto');
            } else {
                console.warn('无法获取后端引擎信息');
            }
        } catch (error) {
            console.warn('获取后端引擎信息失败:', error);
        } finally {
            setIsLoadingEngines(false);
        }
    }, [processingMode]);

    /**
     * 处理模式切换
     */
    const handleModeChange = useCallback((newMode) => {
        setProcessingMode(newMode);
        ocrProcessor.setOcrMode(newMode);
        
        // 如果切换到后端模式，获取可用引擎
        if (newMode === 'backend') {
            fetchAvailableEngines();
        }
    }, [ocrProcessor, fetchAvailableEngines]);

    /**
     * 处理文件选择
     */
    const handleFileSelect = useCallback((event) => {
        const files = Array.from(event.target.files);
        const imageFiles = files.filter(file => file.type.startsWith('image/'));
        
        if (imageFiles.length !== files.length) {
            onError?.('只支持图像文件，已过滤非图像文件');
        }
        
        setSelectedFiles(imageFiles);
        setOcrResults(null); // 清除之前的结果
    }, [onError]);

    /**
     * 处理拖拽上传
     */
    const handleDrop = useCallback((event) => {
        event.preventDefault();
        const files = Array.from(event.dataTransfer.files);
        const imageFiles = files.filter(file => file.type.startsWith('image/'));
        
        if (imageFiles.length > 0) {
            setSelectedFiles(prev => [...prev, ...imageFiles]);
        } else {
            onError?.('请拖拽图像文件');
        }
    }, [onError]);

    const handleDragOver = useCallback((event) => {
        event.preventDefault();
    }, []);

    /**
     * 开始 OCR 处理
     */
    const startOCRProcessing = useCallback(async () => {
        if (selectedFiles.length === 0) {
            onError?.('请先选择图像文件');
            return;
        }

        // 设置 OCR 模式和引擎
        ocrProcessor.setOcrMode(processingMode);
        
        // 开始处理
        await ocrProcessor.processFiles(selectedFiles, ocrEngine);
    }, [selectedFiles, processingMode, ocrEngine, ocrProcessor, onError]);

    /**
     * OCR 完成回调
     */
    function handleOCRComplete(results) {
        console.log('OCR 处理完成:', results);
        setOcrResults(results);
        
        // 将提取的地点信息传递给父组件
        if (results.locations && results.locations.length > 0) {
            // 转换为标准格式
            const standardLocations = convertOCRResultsToStandardFormat(results);
            onLocationsExtracted?.(standardLocations);
        }
    }

    /**
     * OCR 错误回调
     */
    function handleOCRError(error) {
        console.error('OCR 处理错误:', error);
        onError?.(error);
    }

    /**
     * 将 OCR 结果转换为标准地点格式
     */
    const convertOCRResultsToStandardFormat = useCallback((ocrResults) => {
        return ocrResults.locations.map((location, index) => ({
            id: `ocr_${Date.now()}_${index}`,
            name: location.name,
            type: getLocationTypeLabel(location.type),
            address: location.type === 'address' ? location.name : '',
            source: location.source || 'OCR',
            confidence: location.confidence || 0.8,
            extractedFrom: location.source,
            metadata: {
                ocr_type: location.type,
                source_file: location.source,
                needs_geocoding: true,
                processing_mode: processingMode,
                engine_used: ocrEngine
            }
        }));
    }, [processingMode, ocrEngine]);

    /**
     * 获取地点类型标签
     */
    const getLocationTypeLabel = useCallback((type) => {
        const typeMap = {
            'business': 'Business',
            'address': 'Address',
            'location': 'Location',
            'landmark': 'Landmark',
            'street': 'Street'
        };
        return typeMap[type] || 'Location';
    }, []);

    /**
     * 移除选中的文件
     */
    const removeFile = useCallback((index) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    }, []);

    /**
     * 清除所有文件
     */
    const clearAllFiles = useCallback(() => {
        setSelectedFiles([]);
        setOcrResults(null);
    }, []);

    /**
     * 选择地点回调
     */
    const handleLocationSelect = useCallback((location) => {
        console.log('选择地点:', location);
        // 可以在这里添加单个地点的处理逻辑
    }, []);

    /**
     * 测试后端 OCR 功能
     */
    const testBackendOCR = useCallback(async () => {
        try {
            const response = await fetch('http://localhost:8000/api/ocr/test', {
                method: 'POST'
            });
            
            if (response.ok) {
                const testResults = await response.json();
                console.log('后端 OCR 测试结果:', testResults);
                
                // 将测试结果转换为标准格式
                if (testResults.sample_results && testResults.sample_results.length > 0) {
                    const testLocations = [];
                    
                    testResults.sample_results.forEach((result, index) => {
                        if (result.success && result.extracted_info) {
                            const { locations, addresses, business_names } = result.extracted_info;
                            
                            [...locations, ...addresses, ...business_names].forEach((name, i) => {
                                testLocations.push({
                                    id: `test_${index}_${i}`,
                                    name: name,
                                    type: 'Test Location',
                                    source: result.sample_image,
                                    confidence: result.confidence || 0.8,
                                    metadata: {
                                        is_test_data: true,
                                        sample_image: result.sample_image
                                    }
                                });
                            });
                        }
                    });
                    
                    if (testLocations.length > 0) {
                        onLocationsExtracted?.(testLocations);
                    }
                }
                
                onError?.(`后端测试完成：处理了 ${testResults.processed_samples} 个示例图片`);
            } else {
                throw new Error('后端测试失败');
            }
        } catch (error) {
            console.error('后端 OCR 测试失败:', error);
            onError?.('后端 OCR 测试失败，请确保后端服务正在运行');
        }
    }, [onLocationsExtracted, onError]);

    return (
        <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                    🔍 OCR 文本识别
                </h2>
                <div className="flex items-center space-x-2">
                    {/* OCR 模式选择 */}
                    <select
                        value={processingMode}
                        onChange={(e) => handleModeChange(e.target.value)}
                        className="text-xs border rounded px-2 py-1"
                        disabled={ocrProcessor.isProcessing}
                    >
                        <option value="frontend">前端处理</option>
                        <option value="backend">后端处理</option>
                    </select>
                    
                    {/* OCR 引擎选择（后端模式） */}
                    {processingMode === 'backend' && (
                        <select
                            value={ocrEngine}
                            onChange={(e) => setOcrEngine(e.target.value)}
                            className="text-xs border rounded px-2 py-1"
                            disabled={ocrProcessor.isProcessing || isLoadingEngines}
                        >
                            <option value="auto">自动选择</option>
                            <option value="tesseract">Tesseract</option>
                            <option value="paddle">PaddleOCR</option>
                        </select>
                    )}
                    
                    {/* 测试按钮 */}
                    {processingMode === 'backend' && (
                        <button
                            onClick={testBackendOCR}
                            className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200"
                            disabled={ocrProcessor.isProcessing}
                        >
                            测试后端
                        </button>
                    )}
                </div>
            </div>

            {/* 引擎状态显示 */}
            {processingMode === 'backend' && availableEngines && (
                <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                    <h4 className="text-sm font-medium text-blue-900 mb-2">后端引擎状态</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                        {Object.entries(availableEngines.engines).map(([key, engine]) => (
                            <div key={key} className="flex items-center">
                                <span className={engine.available ? 'text-green-600' : 'text-red-600'}>
                                    {engine.available ? '✅' : '❌'}
                                </span>
                                <span className="ml-1">{engine.name}</span>
                            </div>
                        ))}
                    </div>
                    <p className="text-xs text-blue-700 mt-1">
                        推荐引擎: {availableEngines.recommended}
                    </p>
                </div>
            )}

            <p className="text-gray-600 mb-6">
                上传包含地点信息的图像（截图、照片等），AI 将自动识别并提取地理位置信息。
                支持中英文混合识别。
            </p>

            {/* 文件上传区域 */}
            <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
            >
                <div className="space-y-4">
                    <div className="text-4xl">📷</div>
                    <div>
                        <p className="text-lg font-medium text-gray-900">
                            拖拽图像文件到这里
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                            或者点击选择文件
                        </p>
                    </div>
                    <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                        id="ocr-file-input"
                        disabled={ocrProcessor.isProcessing}
                    />
                    <label
                        htmlFor="ocr-file-input"
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 cursor-pointer disabled:opacity-50"
                    >
                        选择图像文件
                    </label>
                </div>
            </div>

            {/* 选中的文件列表 */}
            {selectedFiles.length > 0 && (
                <div className="mt-6">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-medium text-gray-900">
                            已选择 {selectedFiles.length} 个文件
                        </h3>
                        <button
                            onClick={clearAllFiles}
                            className="text-xs text-red-600 hover:text-red-800"
                            disabled={ocrProcessor.isProcessing}
                        >
                            清除全部
                        </button>
                    </div>
                    
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                        {selectedFiles.map((file, index) => (
                            <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                <div className="flex items-center space-x-2">
                                    <span className="text-sm font-medium">{file.name}</span>
                                    <span className="text-xs text-gray-500">
                                        ({(file.size / 1024).toFixed(1)} KB)
                                    </span>
                                </div>
                                <button
                                    onClick={() => removeFile(index)}
                                    className="text-red-600 hover:text-red-800 text-sm"
                                    disabled={ocrProcessor.isProcessing}
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* 开始处理按钮 */}
                    <div className="mt-4 flex justify-center">
                        <button
                            onClick={startOCRProcessing}
                            disabled={ocrProcessor.isProcessing || selectedFiles.length === 0}
                            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                        >
                            {ocrProcessor.isProcessing ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    <span>处理中...</span>
                                </>
                            ) : (
                                <>
                                    <span>🚀</span>
                                    <span>开始 OCR 识别</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* OCR 处理状态 */}
            <OCRStatus
                isProcessing={ocrProcessor.isProcessing}
                progress={ocrProcessor.progress}
                currentFile={ocrProcessor.currentFile}
            />

            {/* OCR 结果显示 */}
            <OCRResults
                results={ocrResults}
                onLocationSelect={handleLocationSelect}
            />

            {/* 处理模式说明 */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="text-sm font-medium text-gray-900 mb-2">处理模式说明</h4>
                <div className="text-xs text-gray-600 space-y-1">
                    <p><strong>前端处理:</strong> 使用 Tesseract.js 在浏览器中处理，数据不会上传到服务器，但处理速度较慢</p>
                    <p><strong>后端处理:</strong> 使用服务器端的 OCR 引擎，处理速度快，支持更多功能，但需要上传图像</p>
                    <p><strong>引擎选择:</strong> Tesseract 适合英文，PaddleOCR 对中文支持更好，自动选择会根据可用性智能选择</p>
                </div>
            </div>
        </div>
    );
}

/**
 * OCR 快速操作按钮组件
 */
export function OCRQuickActions({ onLoadSampleImages, onClearResults, onTestBackend }) {
    return (
        <div className="flex items-center space-x-2 mb-4">
            <button
                onClick={onLoadSampleImages}
                className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors"
            >
                📷 加载示例图片
            </button>
            <button
                onClick={onClearResults}
                className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
            >
                🗑️ 清除结果
            </button>
            {onTestBackend && (
                <button
                    onClick={onTestBackend}
                    className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded-full hover:bg-green-200 transition-colors"
                >
                    🧪 测试后端
                </button>
            )}
        </div>
    );
}