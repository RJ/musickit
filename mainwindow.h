#ifndef MAINWINDOW_H
#define MAINWINDOW_H

#include <QMainWindow>

#include <Phonon/AudioOutput>
#include <Phonon/MediaObject>
#include <Phonon/BackendCapabilities>
#include <QString>
#include <QUrl>
#include <QPushButton>
#include <QWebView>
#include <QEvent>
#include <QMenuBar>
#include <QNetworkAccessManager>

#include "qplaydar.h"
#include "player/playengine.h"

#include "WebkitApi.h"

// Subclass this just so we can print js errors:
class Webpage : public QWebPage
{
    virtual void javaScriptConsoleMessage ( const QString & message, int lineNumber, const QString & sourceID )
    {
        qDebug() << message << " @ no. " << lineNumber << " sourceid: " << sourceID;
    }
};


class MainWindow : QMainWindow {
    Q_OBJECT

public:
    MainWindow();
    ~MainWindow();
    //friend class WebkitApi;
    QSize sizeHint() const {
        return QSize(800, 480);
    }

protected:


private slots:


private:

    WebkitApi * webkitApi;
    QWebView * webView;
    Playdar::Client * pc;
    Playengine * player;
    QMenu * fileMenu;
    QNetworkAccessManager * nam;

    void setupUi();


    //void jseval(QString);

};

#endif // MAINWINDOW_H
