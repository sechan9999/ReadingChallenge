
import { MnistData } from './data.js';

// DOM Elements
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const predictBtn = document.getElementById('predict-btn');
const clearBtn = document.getElementById('clear-btn');
const trainBtn = document.getElementById('train-btn');
const predictionText = document.getElementById('prediction-text');
const statusDiv = document.getElementById('status');
const historyList = document.getElementById('history-list');

// State
let isDrawing = false;
let model;
let lastX = 0;
let lastY = 0;

// Variables for training
let data;

// 1. Initialize Canvas
function initCanvas() {
    ctx.strokeStyle = "white";
    ctx.lineWidth = 18;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

initCanvas();

// ============================================
// Model Definition
// ============================================

function getModel() {
    const model = tf.sequential();

    const IMAGE_WIDTH = 28;
    const IMAGE_HEIGHT = 28;
    const IMAGE_CHANNELS = 1;

    // Conv 1
    model.add(tf.layers.conv2d({
        inputShape: [IMAGE_WIDTH, IMAGE_HEIGHT, IMAGE_CHANNELS],
        kernelSize: 5,
        filters: 8,
        strides: 1,
        activation: 'relu',
        kernelInitializer: 'varianceScaling'
    }));
    model.add(tf.layers.maxPooling2d({ poolSize: [2, 2], strides: [2, 2] }));

    // Conv 2
    model.add(tf.layers.conv2d({
        kernelSize: 5,
        filters: 16,
        strides: 1,
        activation: 'relu',
        kernelInitializer: 'varianceScaling'
    }));
    model.add(tf.layers.maxPooling2d({ poolSize: [2, 2], strides: [2, 2] }));

    // Flatten & Dense
    model.add(tf.layers.flatten());
    model.add(tf.layers.dense({
        units: 10,
        kernelInitializer: 'varianceScaling',
        activation: 'softmax'
    }));

    const optimizer = tf.train.adam();
    model.compile({
        optimizer: optimizer,
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy'],
    });

    return model;
}

// 2. Load Initial Model (Try local, else create fresh)
async function loadInitialModel() {
    try {
        statusDiv.innerHTML = '<span style="color: #d69e2e">Loading neural network...</span>';

        // Try to load pre-trained from file
        // If file doesn't exist or is incompatible, we might error out.
        // We'll try-catch.
        model = await tf.loadLayersModel('./model.json');

        // Check if model fits our new architecture expectations (CNN)
        // If the loaded model expects flattened input (784 instead of [28,28,1]), 
        // we might have issues if we strictly enforce CNN input.
        // But let's assume if it loads, we use it. We'll handle input shape in predict.

        console.log("Model loaded from file.");
        // Warmup
        try {
            // Try CNN shape first
            model.predict(tf.zeros([1, 28, 28, 1]));
        } catch (e) {
            // Fallback to flattened shape if old model
            console.warn("Model seems to be old flattened type. We recommend retraining.");
        }

        statusDiv.innerHTML = '<span style="color: var(--success)">System Ready.</span>';
        predictBtn.disabled = false;

    } catch (error) {
        console.warn("Could not load local model. Initializing fresh model.", error);
        model = getModel();
        statusDiv.innerHTML = '<span style="color: var(--text-secondary)">Fresh Model Initialized. Please Retrain.</span>';
        predictBtn.disabled = false; // Allow prediction (garbage out) but better to train
    }
}

loadInitialModel();

// ============================================
// Training Logic
// ============================================

async function train() {
    statusDiv.innerHTML = 'Downloading MNIST Data...';
    trainBtn.disabled = true;

    data = new MnistData();
    await data.load();

    statusDiv.innerHTML = 'Training... (Check Console)';

    // If we didn't have a model or want to reset
    // We can either fine-tune or reset. Let's reset for "Retrain" to be sure.
    model = getModel();

    const BATCH_SIZE = 512;
    const TRAIN_DATA_SIZE = 5500; // Small subset for speed demo, full is 55000
    const TEST_DATA_SIZE = 1000;

    const [trainXs, trainYs] = tf.tidy(() => {
        const d = data.nextTrainBatch(TRAIN_DATA_SIZE);
        return [
            d.xs.reshape([TRAIN_DATA_SIZE, 28, 28, 1]),
            d.labels
        ];
    });

    const [testXs, testYs] = tf.tidy(() => {
        const d = data.nextTestBatch(TEST_DATA_SIZE);
        return [
            d.xs.reshape([TEST_DATA_SIZE, 28, 28, 1]),
            d.labels
        ];
    });

    await model.fit(trainXs, trainYs, {
        batchSize: BATCH_SIZE,
        validationData: [testXs, testYs],
        epochs: 3, // Quick training
        shuffle: true,
        callbacks: {
            onEpochEnd: (epoch, logs) => {
                statusDiv.innerHTML = `Training Epoch ${epoch + 1}: Acc ${logs.acc.toFixed(3)}`;
                console.log(`Epoch ${epoch + 1} loss: ${logs.loss}, acc: ${logs.acc}`);
            }
        }
    });

    trainXs.dispose();
    trainYs.dispose();
    testXs.dispose();
    testYs.dispose();

    statusDiv.innerHTML = '<span style="color: var(--success)">Training Complete!</span>';
    trainBtn.disabled = false;
    predictBtn.disabled = false;
}

trainBtn.addEventListener('click', train);

// ============================================
// Drawing Interaction
// ============================================

function startDrawing(e) {
    isDrawing = true;
    [lastX, lastY] = getCoords(e);
}

function stopDrawing() {
    isDrawing = false;
    ctx.beginPath();
}

function draw(e) {
    if (!isDrawing) return;

    e.preventDefault();
    const [x, y] = getCoords(e);

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.stroke();

    [lastX, lastY] = [x, y];
}

function getCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return [clientX - rect.left, clientY - rect.top];
}

canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseout', stopDrawing);

canvas.addEventListener('touchstart', startDrawing, { passive: false });
canvas.addEventListener('touchmove', draw, { passive: false });
canvas.addEventListener('touchend', stopDrawing);

// ============================================
// Prediction
// ============================================

predictBtn.addEventListener('click', async () => {
    if (!model) return;

    statusDiv.innerText = "Analyzing...";

    const predictionData = tf.tidy(() => {
        let tensor = tf.browser.fromPixels(canvas, 1);

        // --- Preprocessing: Bounding Box & Centering ---
        const values = tensor.dataSync();
        const width = tensor.shape[1];
        const height = tensor.shape[0];

        let minX = width, minY = height, maxX = 0, maxY = 0;
        let found = false;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (values[y * width + x] > 0) {
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                    found = true;
                }
            }
        }

        if (!found) {
            return new Float32Array(10).fill(0);
        }

        const padding = 20;
        minX = Math.max(0, minX - padding);
        minY = Math.max(0, minY - padding);
        maxX = Math.min(width, maxX + padding);
        maxY = Math.min(height, maxY + padding);

        const cropWidth = maxX - minX;
        const cropHeight = maxY - minY;

        let cropped = tensor.slice([minY, minX, 0], [cropHeight, cropWidth, 1]);

        // Resize largest side to 20
        let scale = 20 / Math.max(cropHeight, cropWidth);
        let scaledH = Math.round(cropHeight * scale);
        let scaledW = Math.round(cropWidth * scale);

        let resized = tf.image.resizeBilinear(cropped, [scaledH, scaledW]);

        // Center on 28x28
        let padY = Math.floor((28 - scaledH) / 2);
        let padX = Math.floor((28 - scaledW) / 2);

        let padded = resized.pad([
            [padY, 28 - scaledH - padY],
            [padX, 28 - scaledW - padX],
            [0, 0]
        ]);

        padded = padded.cast('float32').div(tf.scalar(255.0));

        // Predict (Batch size 1, 28, 28, 1)
        return model.predict(padded.expandDims(0)).dataSync();
    });

    const maxProb = Math.max(...predictionData);
    const predictedDigit = predictionData.indexOf(maxProb);

    updateResult(predictedDigit);
    updateChart(predictionData);
    addToHistory(predictedDigit);

    statusDiv.innerHTML = `<span style="color: var(--success)">Analysis Complete.</span>`;
});

function updateResult(digit) {
    predictionText.style.opacity = 0;
    setTimeout(() => {
        predictionText.innerText = digit;
        predictionText.style.opacity = 1;
    }, 100);
}

function updateChart(data) {
    for (let i = 0; i < 10; i++) {
        const percentage = (data[i] * 100).toFixed(1);
        const barFill = document.getElementById(`bar-fill-${i}`);
        const probLabel = document.getElementById(`prob-label-${i}`);

        if (barFill && probLabel) {
            barFill.style.width = `${percentage}%`;
            probLabel.innerText = `${Math.round(percentage)}%`;

            if (data[i] === Math.max(...data)) {
                barFill.style.background = "var(--success)";
            } else {
                barFill.style.background = "linear-gradient(90deg, #667eea, #764ba2)";
            }
        }
    }
}

function addToHistory(digit) {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.innerText = digit;

    historyList.insertBefore(item, historyList.firstChild);

    if (historyList.children.length > 5) {
        historyList.removeChild(historyList.lastChild);
    }
}

clearBtn.addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    initCanvas();
    predictionText.innerText = "-";
    statusDiv.innerHTML = '<span style="color: var(--text-secondary)">Canvas Cleared.</span>';

    for (let i = 0; i < 10; i++) {
        document.getElementById(`bar-fill-${i}`).style.width = '0%';
        document.getElementById(`prob-label-${i}`).innerText = '0%';
    }
});
