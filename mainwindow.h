#ifndef MAINWINDOW_H
#define MAINWINDOW_H

#include <QMainWindow>

#include <Phonon/AudioOutput>
#include <Phonon/SeekSlider>
#include <Phonon/MediaObject>
#include <Phonon/VolumeSlider>
#include <Phonon/BackendCapabilities>
#include <QString>
#include <QUrl>

#include "WebkitApi.h"

namespace Ui {
    class MainWindow;
}

class MainWindow : public QMainWindow {
    Q_OBJECT
public:
    MainWindow(QWidget *parent = 0);
    ~MainWindow();

protected:
    void changeEvent(QEvent *e);

private slots:
    void on_pushButton_2_clicked();
    void on_pushButton_clicked();
    void stateChanged(Phonon::State newState, Phonon::State oldState);
    void tick(qint64 time);
    void sourceChanged(const Phonon::MediaSource &source);
    void metaStateChanged(Phonon::State newState, Phonon::State oldState);
    void aboutToFinish();
    void bufferPercent(int);
    void volumeChanged(qreal);

    void togglePause();
    void setVolume(int);
    void play(QString);
    void stop();

private:

    WebkitApi * webkitApi;

    Ui::MainWindow *ui;

    void play(QUrl);

    Phonon::MediaObject *mediaObject;
    Phonon::MediaObject *metaInformationResolver;
    Phonon::AudioOutput *audioOutput;
    Phonon::MediaSource *source;

    void log(QString);
    void jseval(QString);

};

#endif // MAINWINDOW_H
